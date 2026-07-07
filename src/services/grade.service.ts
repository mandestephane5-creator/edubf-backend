import { prisma } from "../config/db";
import { ApiError } from "../utils/ApiError";
import { CreateGradeInput } from "../validators/academic.validator";

/**
 * Classe un libellé de note en "composition" ou "devoir" (tout le reste : Devoir 1,
 * Devoir 2, Devoir 3... compte comme un devoir). Insensible à la casse/aux accents.
 */
function classifyLabel(label: string | null): "composition" | "devoir" {
  const normalized = (label || "").toLowerCase();
  return normalized.includes("composition") ? "composition" : "devoir";
}

export const gradeService = {
  async list(
    schoolId: string,
    filters: { classId?: string; studentId?: string; subjectId?: string; term?: string; academicYear?: string }
  ) {
    return prisma.grade.findMany({
      where: { schoolId, ...filters } as any,
      include: { student: true, subject: true, class: true, enteredBy: { select: { email: true } } },
      orderBy: { createdAt: "desc" },
    });
  },

  async create(schoolId: string, enteredByUserId: string, input: CreateGradeInput) {
    const student = await prisma.student.findFirst({ where: { id: input.studentId, schoolId } });
    if (!student) throw ApiError.badRequest("Élève invalide pour cette école");
    return prisma.grade.create({
      data: { schoolId, enteredByUserId, ...input },
      include: { subject: true, student: true },
    });
  },

  async update(schoolId: string, id: string, performedByUserId: string, input: Partial<CreateGradeInput>) {
    const grade = await prisma.grade.findFirst({ where: { id, schoolId }, include: { student: true, subject: true } });
    if (!grade) throw ApiError.notFound("Note introuvable");

    const updated = await prisma.grade.update({ where: { id }, data: input });

    if (input.value !== undefined && input.value !== grade.value) {
      await prisma.gradeAuditLog.create({
        data: {
          schoolId,
          gradeId: id,
          studentName: `${grade.student.firstName} ${grade.student.lastName}`,
          subjectName: grade.subject.name,
          action: "updated",
          oldValue: grade.value,
          newValue: input.value,
          performedByUserId,
        },
      });
    }

    return updated;
  },

  async remove(schoolId: string, id: string, performedByUserId: string) {
    const grade = await prisma.grade.findFirst({ where: { id, schoolId }, include: { student: true, subject: true } });
    if (!grade) throw ApiError.notFound("Note introuvable");

    await prisma.gradeAuditLog.create({
      data: {
        schoolId,
        gradeId: id,
        studentName: `${grade.student.firstName} ${grade.student.lastName}`,
        subjectName: grade.subject.name,
        action: "deleted",
        oldValue: grade.value,
        newValue: null,
        performedByUserId,
      },
    });

    return prisma.grade.delete({ where: { id } });
  },

  /** Historique des modifications/suppressions de notes — traçabilité pour l'admin */
  async listAuditLog(schoolId: string, limit = 100) {
    return prisma.gradeAuditLog.findMany({
      where: { schoolId },
      include: { performedBy: { select: { email: true } } },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
  },

  /**
   * Moyenne générale d'un élève pour un trimestre donné, selon la méthode de l'école :
   *
   * 1. Moyenne par matière = ((Devoir1 + Devoir2) / 2 + Composition) / 2
   *    (si un devoir ou la composition manque encore, on utilise ce qui est disponible
   *    plutôt que de bloquer le calcul — une matière sans aucune note n'est pas comptée)
   * 2. Moyenne trimestrielle = moyenne des moyennes par matière, pondérée par coefficient
   * 3. Moyenne de composition (globale) = Σ(composition × coefficient) / Σ(coefficient),
   *    calculée séparément à titre indicatif
   */
  async computeStudentAverage(schoolId: string, studentId: string, term: string, academicYear: string) {
    const grades = await prisma.grade.findMany({
      where: { schoolId, studentId, term: term as any, academicYear },
      include: { subject: true },
    });
    if (grades.length === 0) return { average: 0, compositionAverage: 0, bySubject: [] };

    const bySubjectMap = new Map<
      string,
      { subjectName: string; coefficient: number; devoirs: number[]; compositions: number[] }
    >();
    for (const g of grades) {
      const normalized = (g.value / g.maxValue) * 20;
      if (!bySubjectMap.has(g.subjectId)) {
        bySubjectMap.set(g.subjectId, { subjectName: g.subject.name, coefficient: g.coefficient, devoirs: [], compositions: [] });
      }
      const entry = bySubjectMap.get(g.subjectId)!;
      if (classifyLabel(g.label) === "composition") entry.compositions.push(normalized);
      else entry.devoirs.push(normalized);
    }

    let weightedSum = 0;
    let coefficientSum = 0;
    let compositionWeightedSum = 0;
    let compositionCoefficientSum = 0;

    const bySubject = Array.from(bySubjectMap.entries()).map(([subjectId, data]) => {
      const devoirsAvg = data.devoirs.length > 0 ? data.devoirs.reduce((a, b) => a + b, 0) / data.devoirs.length : null;
      const compositionAvg =
        data.compositions.length > 0 ? data.compositions.reduce((a, b) => a + b, 0) / data.compositions.length : null;

      let subjectAverage: number | null;
      if (devoirsAvg !== null && compositionAvg !== null) {
        subjectAverage = (devoirsAvg + compositionAvg) / 2;
      } else if (devoirsAvg !== null) {
        subjectAverage = devoirsAvg;
      } else {
        subjectAverage = compositionAvg;
      }

      if (subjectAverage !== null) {
        weightedSum += subjectAverage * data.coefficient;
        coefficientSum += data.coefficient;
      }
      if (compositionAvg !== null) {
        compositionWeightedSum += compositionAvg * data.coefficient;
        compositionCoefficientSum += data.coefficient;
      }

      return {
        subjectId,
        subjectName: data.subjectName,
        average: subjectAverage !== null ? round2(subjectAverage) : 0,
        coefficient: data.coefficient,
      };
    });

    const average = coefficientSum > 0 ? weightedSum / coefficientSum : 0;
    const compositionAverage = compositionCoefficientSum > 0 ? compositionWeightedSum / compositionCoefficientSum : 0;

    return { average: round2(average), compositionAverage: round2(compositionAverage), bySubject };
  },

  async computeClassRanking(schoolId: string, classId: string, term: string, academicYear: string) {
    const students = await prisma.student.findMany({ where: { schoolId, classId } });
    const results = await Promise.all(
      students.map(async (student) => {
        const { average } = await this.computeStudentAverage(schoolId, student.id, term, academicYear);
        return { studentId: student.id, firstName: student.firstName, lastName: student.lastName, average };
      })
    );
    results.sort((a, b) => b.average - a.average);
    return results.map((r, index) => ({ ...r, rank: index + 1 }));
  },

  /**
   * Statistiques agrégées d'une classe : moyenne générale, nombre d'incidents ce
   * mois-ci, effectif — pour un coup d'œil rapide côté admin, sans naviguer entre
   * plusieurs pages.
   */
  async computeClassAverageOnly(schoolId: string, classId: string, term: string, academicYear: string) {
    const ranking = await this.computeClassRanking(schoolId, classId, term, academicYear);
    const withGrades = ranking.filter((r) => r.average > 0);
    if (withGrades.length === 0) return { average: 0, studentCount: ranking.length };
    const avg = withGrades.reduce((sum, r) => sum + r.average, 0) / withGrades.length;
    return { average: round2(avg), studentCount: ranking.length };
  },
};

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
