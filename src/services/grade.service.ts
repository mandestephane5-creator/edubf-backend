import { prisma } from "../config/db";
import { ApiError } from "../utils/ApiError";
import { CreateGradeInput } from "../validators/academic.validator";

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

  async update(schoolId: string, id: string, input: Partial<CreateGradeInput>) {
    const grade = await prisma.grade.findFirst({ where: { id, schoolId } });
    if (!grade) throw ApiError.notFound("Note introuvable");
    return prisma.grade.update({ where: { id }, data: input });
  },

  async remove(schoolId: string, id: string) {
    const grade = await prisma.grade.findFirst({ where: { id, schoolId } });
    if (!grade) throw ApiError.notFound("Note introuvable");
    return prisma.grade.delete({ where: { id } });
  },

  /** Moyenne générale pondérée d'un élève pour un trimestre donné */
  async computeStudentAverage(schoolId: string, studentId: string, term: string, academicYear: string) {
    const grades = await prisma.grade.findMany({
      where: { schoolId, studentId, term: term as any, academicYear },
      include: { subject: true },
    });
    if (grades.length === 0) return { average: 0, bySubject: [] };

    const bySubjectMap = new Map<string, { subjectName: string; coefficient: number; values: number[] }>();
    for (const g of grades) {
      const normalized = (g.value / g.maxValue) * 20;
      if (!bySubjectMap.has(g.subjectId)) {
        bySubjectMap.set(g.subjectId, { subjectName: g.subject.name, coefficient: g.coefficient, values: [] });
      }
      bySubjectMap.get(g.subjectId)!.values.push(normalized);
    }

    let weightedSum = 0;
    let coefficientSum = 0;
    const bySubject = Array.from(bySubjectMap.entries()).map(([subjectId, data]) => {
      const subjectAverage = data.values.reduce((a, b) => a + b, 0) / data.values.length;
      weightedSum += subjectAverage * data.coefficient;
      coefficientSum += data.coefficient;
      return { subjectId, subjectName: data.subjectName, average: round2(subjectAverage), coefficient: data.coefficient };
    });

    const average = coefficientSum > 0 ? weightedSum / coefficientSum : 0;
    return { average: round2(average), bySubject };
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
   * Moyenne globale de la classe uniquement (pas de détail par élève) — c'est la seule
   * version accessible aux parents, pour comparer sans exposer les notes des autres enfants.
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
