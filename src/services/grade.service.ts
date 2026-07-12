import { prisma } from "../config/db";
import { ApiError } from "../utils/ApiError";
import { CreateGradeInput } from "../validators/academic.validator";
import { z } from "zod";
import { createGradeBatchSchema } from "../validators/academic.validator";

type GradeBatchInput = z.infer<typeof createGradeBatchSchema>;

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
    filters: { classId?: string; studentId?: string; subjectId?: string; term?: string; academicYear?: string },
    options?: { onlyValidated?: boolean }
  ) {
    return prisma.grade.findMany({
      where: { schoolId, ...filters, ...(options?.onlyValidated && { status: "VALIDATED" }) } as any,
      include: { student: true, subject: true, class: true, enteredBy: { select: { email: true } } },
      orderBy: { createdAt: "desc" },
    });
  },

  /**
   * Une note saisie par un professeur part "en attente" et n'est visible aux parents
   * qu'après validation du surveillant (par classe entière). Les notes saisies par
   * ADMIN/SURVEILLANT sont validées d'emblée, comme avant.
   */
  async create(schoolId: string, enteredByUserId: string, input: CreateGradeInput, enteredByRole?: string) {
    const student = await prisma.student.findFirst({ where: { id: input.studentId, schoolId } });
    if (!student) throw ApiError.badRequest("Élève invalide pour cette école");
    const status = enteredByRole === "TEACHER" ? "PENDING" : "VALIDATED";
    return prisma.grade.create({
      data: { schoolId, enteredByUserId, status, ...input },
      include: { subject: true, student: true },
    });
  },

  /**
   * Soumet toute une série de notes en une fois (ex: le Devoir 1 de toute une classe) —
   * une note existante pour le même élève+matière+trimestre+libellé est mise à jour
   * plutôt que dupliquée. Utilisé par le professeur pour éviter d'envoyer une
   * notification de validation par élève plutôt qu'une seule pour toute la série.
   */
  async createBatch(schoolId: string, enteredByUserId: string, batch: GradeBatchInput, enteredByRole?: string) {
    const status = enteredByRole === "TEACHER" ? "PENDING" : "VALIDATED";
    const results = [];
    for (const item of batch.items) {
      const existing = await prisma.grade.findFirst({
        where: {
          schoolId,
          studentId: item.studentId,
          subjectId: batch.subjectId,
          term: batch.term,
          academicYear: batch.academicYear,
          label: batch.label,
        },
      });
      const grade = existing
        ? await prisma.grade.update({ where: { id: existing.id }, data: { value: item.value, maxValue: item.maxValue, status } })
        : await prisma.grade.create({
            data: {
              schoolId,
              enteredByUserId,
              status,
              studentId: item.studentId,
              classId: batch.classId,
              subjectId: batch.subjectId,
              term: batch.term,
              academicYear: batch.academicYear,
              label: batch.label,
              value: item.value,
              maxValue: item.maxValue,
            },
          });
      results.push(grade);
    }
    return results;
  },

  async update(
    schoolId: string,
    id: string,
    performedByUserId: string,
    input: Partial<CreateGradeInput>,
    performedByRole?: string
  ) {
    const grade = await prisma.grade.findFirst({ where: { id, schoolId }, include: { student: true, subject: true } });
    if (!grade) throw ApiError.notFound("Note introuvable");

    // Si un professeur corrige une note déjà validée (donc déjà visible au parent), elle
    // repasse en attente — le surveillant devra la revalider avant que le parent ne voie
    // la version corrigée. Une note saisie directement par admin/surveillant reste validée.
    const shouldResetToPending = performedByRole === "TEACHER" && grade.status === "VALIDATED";

    const updated = await prisma.grade.update({
      where: { id },
      data: { ...input, ...(shouldResetToPending && { status: "PENDING" }) },
    });

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

  /** Historique des modifications d'une note précise (pour l'écran de correction du professeur) */
  async auditLogForGrade(schoolId: string, gradeId: string) {
    return prisma.gradeAuditLog.findMany({
      where: { schoolId, gradeId },
      include: { performedBy: { select: { email: true, firstName: true, lastName: true } } },
      orderBy: { createdAt: "desc" },
    });
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

  /**
   * Statistiques pour un professeur, limitées à SA classe+matière : répartition des
   * élèves par tranche, comparaison Devoir 1 vs Devoir 2, et la liste des élèves en
   * échec aux DEUX devoirs (à repérer et sur qui agir en priorité).
   */
  async computeTeacherStats(schoolId: string, classId: string, subjectId: string, term: string, academicYear: string) {
    const [students, grades] = await Promise.all([
      prisma.student.findMany({ where: { schoolId, classId } }),
      prisma.grade.findMany({ where: { schoolId, classId, subjectId, term: term as any, academicYear } }),
    ]);

    const byStudent = new Map<string, { devoir1?: number; devoir2?: number; composition?: number }>();
    for (const g of grades) {
      const normalized = (g.value / g.maxValue) * 20;
      const entry = byStudent.get(g.studentId) ?? {};
      const label = (g.label || "").toLowerCase();
      if (label.includes("composition")) entry.composition = normalized;
      else if (label.includes("2")) entry.devoir2 = normalized;
      else entry.devoir1 = normalized;
      byStudent.set(g.studentId, entry);
    }

    const bands = { below10: 0, between10and15: 0, between15and20: 0 };
    const failedBoth: { studentId: string; firstName: string; lastName: string }[] = [];
    let devoir1Sum = 0, devoir1Count = 0, devoir2Sum = 0, devoir2Count = 0;

    for (const s of students) {
      const entry = byStudent.get(s.id);
      if (!entry) continue;

      const devoirsAvg =
        entry.devoir1 !== undefined && entry.devoir2 !== undefined
          ? (entry.devoir1 + entry.devoir2) / 2
          : entry.devoir1 ?? entry.devoir2;
      const subjectAvg =
        devoirsAvg !== undefined && entry.composition !== undefined
          ? (devoirsAvg + entry.composition) / 2
          : devoirsAvg ?? entry.composition;

      if (subjectAvg !== undefined) {
        if (subjectAvg < 10) bands.below10++;
        else if (subjectAvg < 15) bands.between10and15++;
        else bands.between15and20++;
      }

      if (entry.devoir1 !== undefined) { devoir1Sum += entry.devoir1; devoir1Count++; }
      if (entry.devoir2 !== undefined) { devoir2Sum += entry.devoir2; devoir2Count++; }

      if (entry.devoir1 !== undefined && entry.devoir2 !== undefined && entry.devoir1 < 10 && entry.devoir2 < 10) {
        failedBoth.push({ studentId: s.id, firstName: s.firstName, lastName: s.lastName });
      }
    }

    return {
      bands,
      devoir1Average: devoir1Count > 0 ? round2(devoir1Sum / devoir1Count) : null,
      devoir2Average: devoir2Count > 0 ? round2(devoir2Sum / devoir2Count) : null,
      failedBoth,
    };
  },

  /**
   * Statistiques pour la direction : par classe et par matière, plus le taux de
   * réussite interne (élèves admis ÷ élèves ayant composé) — à l'échelle d'une classe
   * ou de l'école entière. Les redoublants (fin d'année) sont calculés séparément.
   */
  async computeSchoolStats(schoolId: string, term: string, academicYear: string) {
    const classes = await prisma.class.findMany({ where: { schoolId }, orderBy: { name: "asc" } });

    const perClass = await Promise.all(
      classes.map(async (c) => {
        const ranking = await this.computeClassRanking(schoolId, c.id, term, academicYear);
        const composed = ranking.filter((r) => r.average > 0);
        const passing = composed.filter((r) => r.average >= 10);
        return {
          classId: c.id,
          className: c.name,
          composedCount: composed.length,
          passingCount: passing.length,
          successRate: composed.length > 0 ? round2((passing.length / composed.length) * 100) : 0,
        };
      })
    );

    const totalComposed = perClass.reduce((sum, c) => sum + c.composedCount, 0);
    const totalPassing = perClass.reduce((sum, c) => sum + c.passingCount, 0);

    return {
      perClass,
      schoolWide: {
        composedCount: totalComposed,
        passingCount: totalPassing,
        successRate: totalComposed > 0 ? round2((totalPassing / totalComposed) * 100) : 0,
      },
    };
  },

  /**
   * Redoublants de fin d'année : moyenne annuelle < 10, calculée en combinant les 3
   * trimestres (moyenne des moyennes trimestrielles disponibles).
   */
  async computeRepeatersForClass(schoolId: string, classId: string, academicYear: string) {
    const students = await prisma.student.findMany({ where: { schoolId, classId } });
    const results = await Promise.all(
      students.map(async (s) => {
        const terms = ["TRIMESTRE_1", "TRIMESTRE_2", "TRIMESTRE_3"];
        const averages = [];
        for (const term of terms) {
          const { average } = await this.computeStudentAverage(schoolId, s.id, term, academicYear);
          if (average > 0) averages.push(average);
        }
        const annualAverage = averages.length > 0 ? round2(averages.reduce((a, b) => a + b, 0) / averages.length) : 0;
        return { studentId: s.id, firstName: s.firstName, lastName: s.lastName, annualAverage, repeating: annualAverage > 0 && annualAverage < 10 };
      })
    );
    return {
      repeaters: results.filter((r) => r.repeating),
      promoted: results.filter((r) => !r.repeating && r.annualAverage > 0),
    };
  },
};

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
