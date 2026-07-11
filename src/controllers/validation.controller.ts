import { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { validationService } from "../services/validation.service";
import { validateClassSchema } from "../validators/staff.validator";

export const validationController = {
  listPendingByClass: asyncHandler(async (req: Request, res: Response) => {
    const data = await validationService.listPendingByClass(req.auth!.schoolId);
    res.json({ success: true, data });
  }),

  getPendingDetail: asyncHandler(async (req: Request, res: Response) => {
    const data = await validationService.getPendingDetailForClass(req.auth!.schoolId, req.params.classId);
    res.json({ success: true, data });
  }),

  validateClass: asyncHandler(async (req: Request, res: Response) => {
    const { classId } = validateClassSchema.parse(req.body);
    const result = await validationService.validateClass(req.auth!.schoolId, classId);
    res.json({ success: true, data: result });
  }),
};
