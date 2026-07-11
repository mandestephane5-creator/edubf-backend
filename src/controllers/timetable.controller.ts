import { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { timetableService } from "../services/timetable.service";
import { createTimetableSlotSchema } from "../validators/academic.validator";
import { ApiError } from "../utils/ApiError";
import { prisma } from "../config/db";

export const timetableController = {
  getForClass: asyncHandler(async (req: Request, res: Response) => {
    if (req.auth!.role === "TEACHER") {
      const assignment = await prisma.teacherAssignment.findFirst({
        where: { schoolId: req.auth!.schoolId, userId: req.auth!.userId, classId: req.params.classId },
      });
      if (!assignment) throw ApiError.forbidden("Vous n'êtes pas assigné à cette classe");
    }
    const slots = await timetableService.getForClass(req.auth!.schoolId, req.params.classId);
    res.json({ success: true, data: slots });
  }),

  createSlot: asyncHandler(async (req: Request, res: Response) => {
    const input = createTimetableSlotSchema.parse(req.body);
    const slot = await timetableService.createSlot(req.auth!.schoolId, input);
    res.status(201).json({ success: true, data: slot });
  }),

  removeSlot: asyncHandler(async (req: Request, res: Response) => {
    await timetableService.removeSlot(req.auth!.schoolId, req.params.id);
    res.status(204).send();
  }),
};
