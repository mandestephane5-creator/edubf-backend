import { prisma } from "../config/db";
import { ApiError } from "../utils/ApiError";
import { CreateEvaluationScheduleInput, CreateCompositionDateInput } from "../validators/academic.validator";

export const evaluationService = {
  async listForClass(schoolId: string, classId: string, term?: string, academicYear?: string) {
    return prisma.evaluationSchedule.findMany({
      where: { schoolId, classId, term: term as any, academicYear },
      include: { subject: true },
      orderBy: { date: "asc" },
    });
  },

  async createDevoir(schoolId: string, input: CreateEvaluationScheduleInput) {
    const cls = await prisma.class.findFirst({ where: { id: input.classId, schoolId } });
    if (!cls) throw ApiError.badRequest("Classe invalide pour cette école");
    return prisma.evaluationSchedule.create({ data: { schoolId, ...input }, include: { subject: true } });
  },

  async removeDevoir(schoolId: string, id: string) {
    const item = await prisma.evaluationSchedule.findFirst({ where: { id, schoolId } });
    if (!item) throw ApiError.notFound("Évaluation introuvable");
    return prisma.evaluationSchedule.delete({ where: { id } });
  },

  /** Jours de composition — valables pour toute l'école (pas par classe) */
  async listCompositionDates(schoolId: string, term?: string, academicYear?: string) {
    return prisma.compositionDate.findMany({
      where: { schoolId, term: term as any, academicYear },
      orderBy: { date: "asc" },
    });
  },

  async createCompositionDate(schoolId: string, input: CreateCompositionDateInput) {
    return prisma.compositionDate.create({ data: { schoolId, ...input } });
  },

  async removeCompositionDate(schoolId: string, id: string) {
    const item = await prisma.compositionDate.findFirst({ where: { id, schoolId } });
    if (!item) throw ApiError.notFound("Date de composition introuvable");
    return prisma.compositionDate.delete({ where: { id } });
  },
};
