import { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { searchService } from "../services/search.service";
import { exportService } from "../services/export.service";
import { riskService } from "../services/risk.service";
import { schoolService } from "../services/school.service";
import { createSurveillantSchema, updateSchoolSettingsSchema } from "../validators/misc.validator";

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
