import { NotificationType } from "@prisma/client";
import { prisma } from "../config/db";
import { ApiError } from "../utils/ApiError";
import { sendPushToUsers } from "../utils/pushNotifications";

export const notificationService = {
  async listForUser(schoolId: string, userId: string, unreadOnly?: boolean) {
    return prisma.notification.findMany({
      where: { schoolId, userId, ...(unreadOnly && { isRead: false }) },
      orderBy: { createdAt: "desc" },
    });
  },

  async create(schoolId: string, userId: string, type: NotificationType, title: string, message: string, studentId?: string) {
    const notif = await prisma.notification.create({ data: { schoolId, userId, type, title, message, studentId } });
    await sendPushToUsers([userId], title, message, studentId ? { studentId } : undefined);
    return notif;
  },

  /** Envoie une notification à tous les parents liés à un élève donné */
  async notifyParentsOfStudent(schoolId: string, studentId: string, type: NotificationType, title: string, message: string) {
    const links = await prisma.studentParent.findMany({
      where: { studentId },
      include: { parent: { include: { user: true } } },
    });
    if (links.length === 0) return;
    const userIds = links.map((l) => l.parent.user.id);
    await prisma.notification.createMany({
      data: userIds.map((userId) => ({ schoolId, userId, type, title, message, studentId })),
    });
    await sendPushToUsers(userIds, title, message, { studentId });
  },

  /** Envoie une notification à une liste d'utilisateurs (ex: tous les parents pour une annonce) */
  async broadcastToUsers(schoolId: string, userIds: string[], type: NotificationType, title: string, message: string) {
    if (userIds.length === 0) return;
    await prisma.notification.createMany({ data: userIds.map((userId) => ({ schoolId, userId, type, title, message })) });
    await sendPushToUsers(userIds, title, message);
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
