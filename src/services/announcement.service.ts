import { prisma } from "../config/db";
import { ApiError } from "../utils/ApiError";

export const announcementService = {
  async list(schoolId: string) {
    return prisma.announcement.findMany({ where: { schoolId }, orderBy: { createdAt: "desc" } });
  },

  async create(schoolId: string, title: string, message: string) {
    return prisma.announcement.create({ data: { schoolId, title, message } });
  },

  async remove(schoolId: string, id: string) {
    const item = await prisma.announcement.findFirst({ where: { id, schoolId } });
    if (!item) throw ApiError.notFound("Annonce introuvable");
    return prisma.announcement.delete({ where: { id } });
  },
};
