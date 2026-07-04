import { prisma } from "../config/db";
import { ApiError } from "../utils/ApiError";
import { hashPassword } from "../utils/password";
import { generatePin } from "../utils/credentials";

export const parentService = {
  async list(schoolId: string, search?: string) {
    return prisma.parent.findMany({
      where: {
        schoolId,
        ...(search && {
          OR: [
            { firstName: { contains: search, mode: "insensitive" } },
            { lastName: { contains: search, mode: "insensitive" } },
          ],
        }),
      },
      include: {
        children: { include: { student: { include: { class: true } } } },
        user: { select: { phone: true, isActive: true } },
      },
      orderBy: { lastName: "asc" },
    });
  },

  async getById(schoolId: string, id: string) {
    const parent = await prisma.parent.findFirst({
      where: { id, schoolId },
      include: { children: { include: { student: { include: { class: true } } } }, user: { select: { phone: true } } },
    });
    if (!parent) throw ApiError.notFound("Parent introuvable");
    return parent;
  },

  async getMyChildren(userId: string) {
    const parent = await prisma.parent.findUnique({
      where: { userId },
      include: { children: { include: { student: { include: { class: true } } } } },
    });
    if (!parent) throw ApiError.notFound("Profil parent introuvable");
    return parent.children.map((c) => c.student);
  },

  /** Vérifie qu'un parent connecté a bien accès à un élève donné */
  async assertOwnsChild(userId: string, studentId: string) {
    const parent = await prisma.parent.findUnique({ where: { userId } });
    if (!parent) throw ApiError.forbidden();
    const link = await prisma.studentParent.findFirst({ where: { parentId: parent.id, studentId } });
    if (!link) throw ApiError.forbidden("Vous n'avez pas accès à cet élève");
  },

  /** Réinitialise le mot de passe (PIN) d'un parent — réservé à l'ADMIN */
  async resetPassword(schoolId: string, parentId: string) {
    const parent = await this.getById(schoolId, parentId);
    const newPin = generatePin();
    const hashed = await hashPassword(newPin);
    await prisma.user.update({
      where: { id: parent.userId },
      data: { password: hashed, failedLoginAttempts: 0, lockedUntil: null },
    });
    return { newPin };
  },
};
