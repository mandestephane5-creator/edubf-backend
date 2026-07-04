import { prisma } from "../config/db";
import { ApiError } from "../utils/ApiError";
import { CreateSubjectInput } from "../validators/misc.validator";

export const subjectService = {
  async list(schoolId: string) {
    return prisma.subject.findMany({ where: { schoolId }, orderBy: { name: "asc" } });
  },

  async getById(schoolId: string, id: string) {
    const subject = await prisma.subject.findFirst({ where: { id, schoolId } });
    if (!subject) throw ApiError.notFound("Matière introuvable");
    return subject;
  },

  async create(schoolId: string, input: CreateSubjectInput) {
    const existing = await prisma.subject.findUnique({ where: { schoolId_name: { schoolId, name: input.name } } });
    if (existing) throw ApiError.conflict("Cette matière existe déjà");
    return prisma.subject.create({ data: { schoolId, ...input } });
  },

  async update(schoolId: string, id: string, input: Partial<CreateSubjectInput>) {
    await this.getById(schoolId, id);
    return prisma.subject.update({ where: { id }, data: input });
  },

  async remove(schoolId: string, id: string) {
    await this.getById(schoolId, id);
    return prisma.subject.delete({ where: { id } });
  },
};
