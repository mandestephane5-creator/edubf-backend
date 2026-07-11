import { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { attendanceService } from "../services/attendance.service";
import { markAttendanceSchema } from "../validators/staff.validator";

export const attendanceController = {
  getForClassAndDate: asyncHandler(async (req: Request, res: Response) => {
    const date = req.query.date ? new Date(req.query.date as string) : new Date();
    const data = await attendanceService.getForClassAndDate(req.auth!.schoolId, req.params.classId, date);
    res.json({ success: true, data });
  }),

  mark: asyncHandler(async (req: Request, res: Response) => {
    const { classId, date, records } = markAttendanceSchema.parse(req.body);
    const result = await attendanceService.markForClass(req.auth!.schoolId, classId, date, records, req.auth!.userId);
    res.json({ success: true, data: result });
  }),

  getForStudent: asyncHandler(async (req: Request, res: Response) => {
    const data = await attendanceService.getForStudent(req.auth!.schoolId, req.params.studentId);
    res.json({ success: true, data });
  }),
};
