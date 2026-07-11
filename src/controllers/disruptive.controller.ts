import { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { disruptiveService } from "../services/disruptive.service";
import { createDisruptiveReportSchema } from "../validators/staff.validator";

export const disruptiveController = {
  report: asyncHandler(async (req: Request, res: Response) => {
    const { studentId } = createDisruptiveReportSchema.parse(req.body);
    const result = await disruptiveService.report(req.auth!.schoolId, studentId, req.auth!.userId);
    res.status(201).json({ success: true, data: result });
  }),

  countsForClass: asyncHandler(async (req: Request, res: Response) => {
    const data = await disruptiveService.currentMonthCountsForClass(req.auth!.schoolId, req.params.classId);
    res.json({ success: true, data });
  }),
};
