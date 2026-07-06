import { prisma } from "../config/db";
import { ApiError } from "../utils/ApiError";
import { notificationService } from "./notification.service";

export const reportService = {
  async create(schoolId: string, userId: string, message: string) {
    return prisma.report.create({ data: { schoolId, userId, message } });
  },

  /** Historique des signalements d'un parent précis — pour qu'il voie le suivi des siens */
  async listMine(userId: string) {
    return prisma.report.findMany({ where: { userId }, orderBy: { createdAt: "desc" } });
  },

  async list(schoolId: string) {
    return prisma.report.findMany({
      where: { schoolId },
      include: { user: { select: { phone: true, email: true, parent: true } } },
      orderBy: { createdAt: "desc" },
    });
  },

  async markResolved(schoolId: string, id: string) {
    const report = await prisma.report.findFirst({ where: { id, schoolId } });
    if (!report) throw ApiError.notFound("Signalement introuvable");
    const updated = await prisma.report.update({ where: { id }, data: { resolved: true } });

    // Prévient le parent que son signalement a été traité (notification interne + push)
    await notificationService.create(
      schoolId,
      report.userId,
      "SYSTEME",
      "Signalement traité",
      "Votre signalement a été pris en compte par l'administration. Merci de votre retour."
    );

    return updated;
  },
};
