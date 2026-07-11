import { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { teacherService } from "../services/teacher.service";
import { createTeacherSchema, updateTeacherAssignmentsSchema } from "../validators/staff.validator";

export const teacherController = {
  list: asyncHandler(async (req: Request, res: Response) => {
    const teachers = await teacherService.list(req.auth!.schoolId);
    res.json({ success: true, data: teachers });
  }),

  create: asyncHandler(async (req: Request, res: Response) => {
    const input = createTeacherSchema.parse(req.body);
    const teacher = await teacherService.create(req.auth!.schoolId, input);
    res.status(201).json({ success: true, data: teacher });
  }),

  updateAssignments: asyncHandler(async (req: Request, res: Response) => {
    const { assignments } = updateTeacherAssignmentsSchema.parse(req.body);
    const teacher = await teacherService.updateAssignments(req.auth!.schoolId, req.params.id, assignments);
    res.json({ success: true, data: teacher });
  }),

  setActive: asyncHandler(async (req: Request, res: Response) => {
    const isActive = !!req.body.isActive;
    const result = await teacherService.setActive(req.auth!.schoolId, req.params.id, isActive);
    res.json({ success: true, data: result });
  }),

  myAssignments: asyncHandler(async (req: Request, res: Response) => {
    const assignments = await teacherService.myAssignments(req.auth!.schoolId, req.auth!.userId);
    res.json({ success: true, data: assignments });
  }),
};
