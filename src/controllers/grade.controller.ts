import { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { gradeService } from "../services/grade.service";
import { notificationService } from "../services/notification.service";
import { parentService } from "../services/parent.service";
import { ApiError } from "../utils/ApiError";
import { createGradeSchema, updateGradeSchema } from "../validators/academic.validator";

export const gradeController = {
  list: asyncHandler(async (req: Request, res: Response) => {
    const { classId, studentId, subjectId, term, academicYear } = req.query;
    if (!req.auth) throw ApiError.unauthorized();
    if (req.auth.role === "PARENT" && studentId) {
      await parentService.assertOwnsChild(req.auth.userId, studentId as string);
    }
    const grades = await gradeService.list(req.auth.schoolId, {
      classId: classId as string | undefined,
      studentId: studentId as string | undefined,
      subjectId: subjectId as string | undefined,
      term: term as string | undefined,
      academicYear: academicYear as string | undefined,
    });
    res.json({ success: true, data: grades });
  }),

  create: asyncHandler(async (req: Request, res: Response) => {
    const input = createGradeSchema.parse(req.body);
    const grade = await gradeService.create(req.auth!.schoolId, req.auth!.userId, input);

    // Notification automatique aux parents de l'élève concerné
    await notificationService.notifyParentsOfStudent(
      req.auth!.schoolId,
      input.studentId,
      "NOTE",
      "Nouvelle note",
      `Une note de ${input.value}/${input.maxValue} a été ajoutée.`
    );

    res.status(201).json({ success: true, data: grade });
  }),

  update: asyncHandler(async (req: Request, res: Response) => {
    const input = updateGradeSchema.parse(req.body);
    const grade = await gradeService.update(req.auth!.schoolId, req.params.id, input);
    res.json({ success: true, data: grade });
  }),

  remove: asyncHandler(async (req: Request, res: Response) => {
    await gradeService.remove(req.auth!.schoolId, req.params.id);
    res.status(204).send();
  }),

  studentAverage: asyncHandler(async (req: Request, res: Response) => {
    const { term, academicYear } = req.query;
    if (req.auth!.role === "PARENT") await parentService.assertOwnsChild(req.auth!.userId, req.params.studentId);
    const result = await gradeService.computeStudentAverage(
      req.auth!.schoolId,
      req.params.studentId,
      term as string,
      academicYear as string
    );
    res.json({ success: true, data: result });
  }),

  classRanking: asyncHandler(async (req: Request, res: Response) => {
    const { term, academicYear } = req.query;
    const result = await gradeService.computeClassRanking(
      req.auth!.schoolId,
      req.params.classId,
      term as string,
      academicYear as string
    );
    res.json({ success: true, data: result });
  }),
};
