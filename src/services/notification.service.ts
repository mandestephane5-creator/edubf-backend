import { NotificationType } from "@prisma/client";
import { prisma } from "../config/db";
import { ApiError } from "../utils/ApiError";

export const notificationService = {
  async listForUser(schoolId: string, userId: string, unreadOnly?: boolean) {
    return prisma.notification.findMany({
      where: { schoolId, userId, ...(unreadOnly && { isRead: false }) },
      orderBy: { createdAt: "desc" },
    });
  },

  async create(schoolId: string, userId: string, type: NotificationType, title: string, message: string) {
    return prisma.notification.create({ data: { schoolId, userId, type, title, message } });
  },

  /** Envoie une notification à tous les parents liés à un élève donné */
  async notifyParentsOfStudent(schoolId: string, studentId: string, type: NotificationType, title: string, message: string) {
    const links = await prisma.studentParent.findMany({
      where: { studentId },
      include: { parent: { include: { user: true } } },
    });
    if (links.length === 0) return;
    await prisma.notification.createMany({
      data: links.map((l) => ({ schoolId, userId: l.parent.user.id, type, title, message })),
    });
  },

  async markAsRead(schoolId: string, userId: string, id: string) {
    const notif = await prisma.notification.findFirst({ where: { id, schoolId, userId } });
    if (!notif) throw ApiError.notFound("Notification introuvable");
    return prisma.notification.update({ where: { id }, data: { isRead: true } });
  },

  async markAllAsRead(schoolId: string, userId: string) {
    return prisma.notification.updateMany({ where: { schoolId, userId, isRead: false }, data: { isRead: true } });
  },
};
