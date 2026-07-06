import { prisma } from "../config/db";
import { ApiError } from "../utils/ApiError";
import { CreateClassInput } from "../validators/misc.validator";
import { gradeService } from "./grade.service";

export const classService = {
  async list(schoolId: string, academicYear?: string) {
    return prisma.class.findMany({
      where: { schoolId, ...(academicYear && { academicYear }) },
      include: { _count: { select: { students: true } }, subjects: { include: { subject: true } } },
      orderBy: { name: "asc" },
    });
  },

  async getById(schoolId: string, id: string) {
    const cls = await prisma.class.findFirst({
      where: { id, schoolId },
      include: { students: true, subjects: { include: { subject: true } } },
    });
    if (!cls) throw ApiError.notFound("Classe introuvable");
    return cls;
  },

  async create(schoolId: string, input: CreateClassInput) {
    return prisma.class.create({ data: { schoolId, ...input } });
  },

  async update(schoolId: string, id: string, input: Partial<CreateClassInput>) {
    await this.getById(schoolId, id);
    return prisma.class.update({ where: { id }, data: input });
  },

  async remove(schoolId: string, id: string) {
    await this.getById(schoolId, id);
    return prisma.class.delete({ where: { id } });
  },

  async assignSubject(schoolId: string, classId: string, subjectId: string, coefficient: number) {
    await this.getById(schoolId, classId);
    const subject = await prisma.subject.findFirst({ where: { id: subjectId, schoolId } });
    if (!subject) throw ApiError.badRequest("Matière invalide pour cette école");
    return prisma.classSubject.upsert({
      where: { classId_subjectId: { classId, subjectId } },
      update: { coefficient },
      create: { classId, subjectId, coefficient },
    });
  },

  async removeSubject(schoolId: string, classId: string, subjectId: string) {
    await this.getById(schoolId, classId);
    return prisma.classSubject.delete({ where: { classId_subjectId: { classId, subjectId } } });
  },

  /**
   * Statistiques agrégées d'une classe : moyenne générale (pondérée), nombre
   * d'incidents ce mois-ci, effectif — pour un coup d'œil rapide côté admin.
   */
  async getStats(schoolId: string, classId: string, term: string, academicYear: string) {
    await this.getById(schoolId, classId);

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    const [studentCount, incidentCount, ranking] = await Promise.all([
      prisma.student.count({ where: { schoolId, classId } }),
      prisma.incident.count({
        where: { schoolId, student: { classId }, date: { gte: monthStart, lt: monthEnd } },
      }),
      gradeService.computeClassRanking(schoolId, classId, term, academicYear),
    ]);

    const withGrades = ranking.filter((r) => r.average > 0);
    const average = withGrades.length > 0 ? withGrades.reduce((sum, r) => sum + r.average, 0) / withGrades.length : 0;

    return {
      studentCount,
      incidentCountThisMonth: incidentCount,
      average: Math.round(average * 100) / 100,
    };
  },
};
