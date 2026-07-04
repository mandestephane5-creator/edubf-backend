import { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { notificationService } from "../services/notification.service";

export const notificationController = {
  list: asyncHandler(async (req: Request, res: Response) => {
    const unreadOnly = req.query.unreadOnly === "true";
    const notifications = await notificationService.listForUser(req.auth!.schoolId, req.auth!.userId, unreadOnly);
    res.json({ success: true, data: notifications });
  }),

  markAsRead: asyncHandler(async (req: Request, res: Response) => {
    const notif = await notificationService.markAsRead(req.auth!.schoolId, req.auth!.userId, req.params.id);
    res.json({ success: true, data: notif });
  }),

  markAllAsRead: asyncHandler(async (req: Request, res: Response) => {
    await notificationService.markAllAsRead(req.auth!.schoolId, req.auth!.userId);
    res.json({ success: true, message: "Toutes les notifications ont été marquées comme lues" });
  }),
};
