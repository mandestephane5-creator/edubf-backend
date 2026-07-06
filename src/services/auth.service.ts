import crypto from "crypto";
import { Role } from "@prisma/client";
import { prisma } from "../config/db";
import { ApiError } from "../utils/ApiError";
import { hashPassword, comparePassword } from "../utils/password";
import { signAccessToken, signRefreshToken, verifyRefreshToken } from "../utils/jwt";
import { sendPasswordResetEmail } from "../utils/email";
import { env } from "../config/env";
import { RegisterSchoolInput, LoginInput } from "../validators/auth.validator";

/** Trouve le(s) compte(s) parent candidats à partir du matricule d'un enfant */
async function resolveParentCandidatesFromMatricule(schoolId: string, matricule: string) {
  const student = await prisma.student.findUnique({
    where: { schoolId_matricule: { schoolId, matricule } },
    include: { parents: { include: { parent: { include: { user: true } } } } },
  });
  if (!student) return [];
  return student.parents.map((sp) => sp.parent.user);
}

export const authService = {
  async registerSchool(input: RegisterSchoolInput) {
    const existingSlug = await prisma.school.findUnique({ where: { slug: input.schoolSlug } });
    if (existingSlug) throw ApiError.conflict("Ce nom d'école (slug) est déjà utilisé");

    const hashed = await hashPassword(input.adminPassword);

    const school = await prisma.school.create({
      data: {
        name: input.schoolName,
        slug: input.schoolSlug,
        country: input.country ?? "Burkina Faso",
        city: input.city,
        phone: input.phone,
        users: { create: { email: input.adminEmail, password: hashed, role: "ADMIN" } },
      },
      include: { users: true },
    });

    const adminUser = school.users[0];
    return this.issueTokens(adminUser.id, school.id, adminUser.role);
  },

  /**
   * Connexion. `identifier` est soit l'email (ADMIN/SURVEILLANT), soit le matricule
   * d'un enfant (PARENT — le mot de passe permet ensuite de désigner lequel des parents
   * liés à cet enfant se connecte).
   */
  async login(input: LoginInput) {
    const school = await prisma.school.findUnique({ where: { slug: input.schoolSlug } });
    if (!school || !school.isActive) throw ApiError.unauthorized("École introuvable ou désactivée");

    // 1) Tentative en tant que staff (email)
    let user = await prisma.user.findUnique({
      where: { schoolId_email: { schoolId: school.id, email: input.identifier } },
    });

    // 2) Sinon, résoudre comme matricule d'élève -> candidats parents
    let candidates = user ? [user] : await resolveParentCandidatesFromMatricule(school.id, input.identifier);

    if (candidates.length === 0) throw ApiError.unauthorized("Identifiants invalides");

    // Vérifie le verrouillage et le mot de passe pour chaque candidat (généralement 1, parfois plusieurs parents)
    for (const candidate of candidates) {
      if (!candidate.isActive) continue;

      if (candidate.lockedUntil && candidate.lockedUntil > new Date()) {
        const minutesLeft = Math.ceil((candidate.lockedUntil.getTime() - Date.now()) / 60000);
        throw ApiError.unauthorized(`Compte temporairement bloqué. Réessayez dans ${minutesLeft} minute(s).`);
      }

      const validPassword = await comparePassword(input.password, candidate.password);
      if (validPassword) {
        await prisma.user.update({
          where: { id: candidate.id },
          data: { failedLoginAttempts: 0, lockedUntil: null, lastLoginAt: new Date() },
        });
        return this.issueTokens(candidate.id, school.id, candidate.role);
      }
    }

    // Aucun candidat n'a le bon mot de passe : incrémente les échecs sur chacun
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

    throw ApiError.unauthorized("Identifiants invalides");
  },

  async refresh(refreshToken: string) {
    let payload;
    try {
      payload = verifyRefreshToken(refreshToken);
    } catch {
      throw ApiError.unauthorized("Refresh token invalide ou expiré");
    }
    const user = await prisma.user.findUnique({ where: { id: payload.userId } });
    if (!user || user.refreshToken !== refreshToken) throw ApiError.unauthorized("Refresh token révoqué");
    return this.issueTokens(user.id, user.schoolId, user.role);
  },

  async logout(userId: string) {
    await prisma.user.update({ where: { id: userId }, data: { refreshToken: null } });
  },

  async issueTokens(userId: string, schoolId: string, role: Role) {
    const payload = { userId, schoolId, role };
    const accessToken = signAccessToken(payload);
    const refreshToken = signRefreshToken(payload);
    await prisma.user.update({ where: { id: userId }, data: { refreshToken } });
    return { accessToken, refreshToken, user: { id: userId, schoolId, role } };
  },

  async me(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        parent: { include: { children: { include: { student: { include: { class: true } } } } } },
        school: {
          select: {
            id: true,
            name: true,
            slug: true,
            logoUrl: true,
            publicWebsiteUrl: true,
            adminPhone: true,
            surveillancePhone: true,
            secretariatHours: true,
            address: true,
          },
        },
      },
    });
    if (!user) throw ApiError.notFound("Utilisateur introuvable");
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password, refreshToken, ...safeUser } = user;
    return safeUser;
  },

  /** Demande de réinitialisation de mot de passe (ADMIN/SURVEILLANT uniquement, via email) */
  async forgotPassword(schoolSlug: string, email: string) {
    const school = await prisma.school.findUnique({ where: { slug: schoolSlug } });
    if (!school) return; // ne révèle pas si l'école existe

    const user = await prisma.user.findUnique({ where: { schoolId_email: { schoolId: school.id, email } } });
    if (!user || user.role === "PARENT") return; // ne révèle pas si le compte existe

    const token = crypto.randomBytes(32).toString("hex");
    await prisma.passwordResetToken.create({
      data: { userId: user.id, token, expiresAt: new Date(Date.now() + 60 * 60 * 1000) },
    });

    const resetLink = `${env.frontendUrl}/reset-password?token=${token}`;
    await sendPasswordResetEmail(email, resetLink);
  },

  async resetPassword(token: string, newPassword: string) {
    const resetToken = await prisma.passwordResetToken.findUnique({ where: { token } });
    if (!resetToken || resetToken.used || resetToken.expiresAt < new Date()) {
      throw ApiError.badRequest("Lien de réinitialisation invalide ou expiré");
    }
    const hashed = await hashPassword(newPassword);
    await prisma.$transaction([
      prisma.user.update({
        where: { id: resetToken.userId },
        data: { password: hashed, failedLoginAttempts: 0, lockedUntil: null },
      }),
      prisma.passwordResetToken.update({ where: { id: resetToken.id }, data: { used: true } }),
    ]);
  },

  /** Le parent change lui-même son mot de passe (PIN 6 chiffres) après connexion */
  async changeParentPassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw ApiError.notFound("Utilisateur introuvable");
    const valid = await comparePassword(currentPassword, user.password);
    if (!valid) throw ApiError.unauthorized("Mot de passe actuel incorrect");
    const hashed = await hashPassword(newPassword);
    await prisma.user.update({
      where: { id: userId },
      data: { password: hashed, mustChangePassword: false, passwordChangedAt: new Date() },
    });
  },
};
