import { prisma } from "../config/db";
import { ApiError } from "../utils/ApiError";

export const calendarService = {
  async list(schoolId: string) {
    return prisma.calendarEvent.findMany({ where: { schoolId }, orderBy: { date: "asc" } });
  },

  async create(schoolId: string, input: { title: string; description?: string; date: Date; endDate?: Date }) {
    return prisma.calendarEvent.create({ data: { schoolId, ...input } });
  },

  async update(schoolId: string, id: string, input: Partial<{ title: string; description: string; date: Date; endDate: Date }>) {
    const event = await prisma.calendarEvent.findFirst({ where: { id, schoolId } });
    if (!event) throw ApiError.notFound("Événement introuvable");
    return prisma.calendarEvent.update({ where: { id }, data: input });
  },

  async remove(schoolId: string, id: string) {
    const event = await prisma.calendarEvent.findFirst({ where: { id, schoolId } });
    if (!event) throw ApiError.notFound("Événement introuvable");
    await prisma.calendarEvent.delete({ where: { id } });
  },
};
