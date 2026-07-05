import { prisma } from "../config/db";
import { ApiError } from "../utils/ApiError";
import { hashPassword } from "../utils/password";
import { generateStaffPassword } from "../utils/credentials";
import { CreateSurveillantInput } from "../validators/misc.validator";

export const schoolService = {
  async getSettings(schoolId: string) {
    const school = await prisma.school.findUnique({ where: { id: schoolId } });
    if (!school) throw ApiError.notFound("École introuvable");
    return school;
  },

  async updateSettings(
    schoolId: string,
    input: {
      name?: string;
      city?: string;
      phone?: string;
      adminPhone?: string;
      surveillancePhone?: string;
      secretariatHours?: string;
      address?: string;
      publicWebsiteUrl?: string;
    }
  ) {
    return prisma.school.update({ where: { id: schoolId }, data: input });
  },

  async listSurveillants(schoolId: string) {
    return prisma.user.findMany({
      where: { schoolId, role: "SURVEILLANT" },
      select: { id: true, email: true, isActive: true, lastLoginAt: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    });
  },

  async createSurveillant(schoolId: string, input: CreateSurveillantInput) {
    const existing = await prisma.user.findUnique({ where: { schoolId_email: { schoolId, email: input.email } } });
    if (existing) throw ApiError.conflict("Cet email est déjà utilisé dans l'école");

    const generatedPassword = generateStaffPassword();
    const hashed = await hashPassword(generatedPassword);
    const user = await prisma.user.create({
      data: { schoolId, email: input.email, password: hashed, role: "SURVEILLANT" },
    });
    return { user: { id: user.id, email: user.email }, temporaryPassword: generatedPassword };
  },

  async deactivateSurveillant(schoolId: string, userId: string) {
    const user = await prisma.user.findFirst({ where: { id: userId, schoolId, role: "SURVEILLANT" } });
    if (!user) throw ApiError.notFound("Surveillant introuvable");
    return prisma.user.update({ where: { id: userId }, data: { isActive: false } });
  },
};
