import { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { searchService } from "../services/search.service";
import { exportService } from "../services/export.service";
import { riskService } from "../services/risk.service";
import { schoolService } from "../services/school.service";
import { announcementService } from "../services/announcement.service";
import { reportService } from "../services/report.service";
import { pushTokenService } from "../services/pushToken.service";
import { notificationService } from "../services/notification.service";
import { prisma } from "../config/db";
import { createSurveillantSchema, updateSchoolSettingsSchema } from "../validators/misc.validator";
import { createAnnouncementSchema, createReportSchema, registerPushTokenSchema } from "../validators/misc.validator";
import { ApiError } from "../utils/ApiError";

export const searchController = {
  searchStudents: asyncHandler(async (req: Request, res: Response) => {
    const results = await searchService.searchStudents(req.auth!.schoolId, (req.query.q as string) ?? "");
    res.json({ success: true, data: results });
  }),
};

export const exportController = {
  classList: asyncHandler(async (req: Request, res: Response) => {
    const csv = await exportService.exportClassList(req.auth!.schoolId, req.params.classId);
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="classe_${req.params.classId}.csv"`);
    res.send(csv);
  }),

  classGrades: asyncHandler(async (req: Request, res: Response) => {
    const { term, academicYear } = req.query;
    const csv = await exportService.exportClassGrades(
      req.auth!.schoolId,
      req.params.classId,
      term as string,
      academicYear as string
    );
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="notes_${req.params.classId}.csv"`);
    res.send(csv);
  }),
};

export const riskController = {
  list: asyncHandler(async (req: Request, res: Response) => {
    const { term, academicYear } = req.query;
    const students = await riskService.listAtRiskStudents(
      req.auth!.schoolId,
      term as string,
      academicYear as string
    );
    res.json({ success: true, data: students });
  }),
};

export const schoolController = {
  getSettings: asyncHandler(async (req: Request, res: Response) => {
    const settings = await schoolService.getSettings(req.auth!.schoolId);
    res.json({ success: true, data: settings });
  }),

  updateSettings: asyncHandler(async (req: Request, res: Response) => {
    const input = updateSchoolSettingsSchema.parse(req.body);
    const settings = await schoolService.updateSettings(req.auth!.schoolId, input);
    res.json({ success: true, data: settings });
  }),

  listSurveillants: asyncHandler(async (req: Request, res: Response) => {
    const list = await schoolService.listSurveillants(req.auth!.schoolId);
    res.json({ success: true, data: list });
  }),

  createSurveillant: asyncHandler(async (req: Request, res: Response) => {
    const input = createSurveillantSchema.parse(req.body);
    const result = await schoolService.createSurveillant(req.auth!.schoolId, input);
    res.status(201).json({ success: true, data: result });
  }),

  deactivateSurveillant: asyncHandler(async (req: Request, res: Response) => {
    await schoolService.deactivateSurveillant(req.auth!.schoolId, req.params.id);
    res.status(204).send();
  }),
};

export const announcementController = {
  list: asyncHandler(async (req: Request, res: Response) => {
    const items = await announcementService.list(req.auth!.schoolId);
    res.json({ success: true, data: items });
  }),

  create: asyncHandler(async (req: Request, res: Response) => {
    const { title, message } = createAnnouncementSchema.parse(req.body);
    const announcement = await announcementService.create(req.auth!.schoolId, title, message);

    // Notifie tous les parents de l'école (avec push)
    const parentUsers = await prisma.user.findMany({ where: { schoolId: req.auth!.schoolId, role: "PARENT" } });
    await notificationService.broadcastToUsers(
      req.auth!.schoolId,
      parentUsers.map((u) => u.id),
      "SYSTEME",
      title,
      message
    );

    res.status(201).json({ success: true, data: announcement });
  }),

  remove: asyncHandler(async (req: Request, res: Response) => {
    await announcementService.remove(req.auth!.schoolId, req.params.id);
    res.status(204).send();
  }),
};

export const reportController = {
  create: asyncHandler(async (req: Request, res: Response) => {
    if (!req.auth) throw ApiError.unauthorized();
    const { message } = createReportSchema.parse(req.body);
    const report = await reportService.create(req.auth.schoolId, req.auth.userId, message);
    res.status(201).json({ success: true, data: report });
  }),

  list: asyncHandler(async (req: Request, res: Response) => {
    const reports = await reportService.list(req.auth!.schoolId);
    res.json({ success: true, data: reports });
  }),

  markResolved: asyncHandler(async (req: Request, res: Response) => {
    const report = await reportService.markResolved(req.auth!.schoolId, req.params.id);
    res.json({ success: true, data: report });
  }),
};

export const pushTokenController = {
  register: asyncHandler(async (req: Request, res: Response) => {
    if (!req.auth) throw ApiError.unauthorized();
    const { token } = registerPushTokenSchema.parse(req.body);
    await pushTokenService.register(req.auth.schoolId, req.auth.userId, token);
    res.status(201).json({ success: true });
  }),
};
