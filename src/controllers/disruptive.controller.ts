import { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { disruptiveService } from "../services/disruptive.service";
import { teacherService } from "../services/teacher.service";
import { createDisruptiveReportSchema } from "../validators/staff.validator";
import { ApiError } from "../utils/ApiError";
import { prisma } from "../config/db";

export const disruptiveController = {
  report: asyncHandler(async (req: Request, res: Response) => {
    const { studentId } = createDisruptiveReportSchema.parse(req.body);

    // Sécurité : un professeur ne peut signaler que les élèves de ses propres classes.
    if (req.auth!.role === "TEACHER") {
      const student = await prisma.student.findFirst({ where: { id: studentId, schoolId: req.auth!.schoolId } });
      if (!student?.classId) throw ApiError.badRequest("Élève sans classe assignée");
      await teacherService.assertAssignedToClass(req.auth!.schoolId, req.auth!.userId, student.classId);
    }

    const result = await disruptiveService.report(req.auth!.schoolId, studentId, req.auth!.userId);
    res.status(201).json({ success: true, data: result });
  }),

  countsForClass: asyncHandler(async (req: Request, res: Response) => {
    if (req.auth!.role === "TEACHER") {
      await teacherService.assertAssignedToClass(req.auth!.schoolId, req.auth!.userId, req.params.classId);
    }
    const data = await disruptiveService.currentMonthCountsForClass(req.auth!.schoolId, req.params.classId);
    res.json({ success: true, data });
  }),
};
