import { prisma } from "../config/db";
import { ApiError } from "../utils/ApiError";

export const reportService = {
  async create(schoolId: string, userId: string, message: string) {
    return prisma.report.create({ data: { schoolId, userId, message } });
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
    return prisma.report.update({ where: { id }, data: { resolved: true } });
  },
};
