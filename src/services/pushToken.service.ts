import { prisma } from "../config/db";

export const pushTokenService = {
  /** Enregistre (ou met à jour) le jeton push d'un appareil pour l'utilisateur connecté */
  async register(schoolId: string, userId: string, token: string) {
    return prisma.pushToken.upsert({
      where: { token },
      update: { userId, schoolId },
      create: { schoolId, userId, token },
    });
  },

  async unregister(token: string) {
    await prisma.pushToken.deleteMany({ where: { token } });
  },
};
