import { prisma } from "../config/db";
import { ApiError } from "../utils/ApiError";
import { hashPassword, comparePassword } from "../utils/password";
import { generatePin } from "../utils/credentials";
import { env } from "../config/env";

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
      data: { password: hashed, failedLoginAttempts: 0, lockedUntil: null, mustChangePassword: true },
    });
    return { newPin };
  },

  /**
   * Permet à un parent déjà connecté d'ajouter à son compte un enfant déjà inscrit
   * (par ex. par un autre parent). Le parent doit prouver qu'il connaît le matricule
   * ET le mot de passe d'un des parents déjà liés à cet élève — même niveau de preuve
   * qu'une connexion classique. Protégé contre le brute-force comme le login normal.
   */
  async linkExistingChild(schoolId: string, requesterUserId: string, matricule: string, password: string) {
    const student = await prisma.student.findUnique({
      where: { schoolId_matricule: { schoolId, matricule } },
      include: { parents: { include: { parent: { include: { user: true } } } } },
    });
    if (!student) throw ApiError.notFound("Aucun élève ne correspond à ce matricule");

    const candidates = student.parents.map((sp) => sp.parent.user);
    if (candidates.length === 0) {
      throw ApiError.badRequest("Cet élève n'a encore aucun parent enregistré");
    }

    for (const candidate of candidates) {
      if (!candidate.isActive) continue;

      if (candidate.lockedUntil && candidate.lockedUntil > new Date()) {
        const minutesLeft = Math.ceil((candidate.lockedUntil.getTime() - Date.now()) / 60000);
        throw ApiError.unauthorized(`Compte temporairement bloqué. Réessayez dans ${minutesLeft} minute(s).`);
      }

      const validPassword = await comparePassword(password, candidate.password);
      if (validPassword) {
        await prisma.user.update({
          where: { id: candidate.id },
          data: { failedLoginAttempts: 0, lockedUntil: null },
        });

        const requesterParent = await prisma.parent.findUnique({ where: { userId: requesterUserId } });
        if (!requesterParent) throw ApiError.forbidden();

        const alreadyLinked = await prisma.studentParent.findFirst({
          where: { studentId: student.id, parentId: requesterParent.id },
        });
        if (!alreadyLinked) {
          await prisma.studentParent.create({ data: { studentId: student.id, parentId: requesterParent.id } });
        }

        return { id: student.id, firstName: student.firstName, lastName: student.lastName };
      }
    }

    // Aucun candidat n'a le bon mot de passe : incrémente les échecs (anti brute-force)
    await Promise.all(
      candidates.map(async (candidate) => {
        const attempts = candidate.failedLoginAttempts + 1;
        const shouldLock = attempts >= env.parentLockout.maxAttempts;
        await prisma.user.update({
          where: { id: candidate.id },
          data: {
            failedLoginAttempts: attempts,
            lockedUntil: shouldLock ? new Date(Date.now() + env.parentLockout.minutes * 60000) : null,
          },
        });
      })
    );

    throw ApiError.unauthorized("Matricule ou mot de passe incorrect");
  },
};
