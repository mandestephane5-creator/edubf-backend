import { prisma } from "../config/db";
import { ApiError } from "../utils/ApiError";
import { CreateTimetableSlotInput } from "../validators/academic.validator";

export const timetableService = {
  async getForClass(schoolId: string, classId: string) {
    return prisma.timetableSlot.findMany({
      where: { schoolId, classId },
      include: { subject: true },
      orderBy: [{ day: "asc" }, { startHour: "asc" }],
    });
  },

  async createSlot(schoolId: string, input: CreateTimetableSlotInput) {
    const cls = await prisma.class.findFirst({ where: { id: input.classId, schoolId } });
    if (!cls) throw ApiError.badRequest("Classe invalide pour cette école");
    const subject = await prisma.subject.findFirst({ where: { id: input.subjectId, schoolId } });
    if (!subject) throw ApiError.badRequest("Matière invalide pour cette école");

    return prisma.timetableSlot.upsert({
      where: { classId_day_startHour: { classId: input.classId, day: input.day, startHour: input.startHour } },
      update: { endHour: input.endHour, subjectId: input.subjectId },
      create: { schoolId, ...input },
    });
  },

  async removeSlot(schoolId: string, id: string) {
    const slot = await prisma.timetableSlot.findFirst({ where: { id, schoolId } });
    if (!slot) throw ApiError.notFound("Créneau introuvable");
    return prisma.timetableSlot.delete({ where: { id } });
  },
};
