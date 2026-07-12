import { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { gradeService } from "../services/grade.service";
import { notificationService } from "../services/notification.service";
import { parentService } from "../services/parent.service";
import { teacherService } from "../services/teacher.service";
import { ApiError } from "../utils/ApiError";
import { createGradeSchema, updateGradeSchema, createGradeBatchSchema } from "../validators/academic.validator";
import { prisma } from "../config/db";

export const gradeController = {
  list: asyncHandler(async (req: Request, res: Response) => {
    const { classId, studentId, subjectId, term, academicYear } = req.query;
    if (!req.auth) throw ApiError.unauthorized();
    if (req.auth.role === "PARENT" && studentId) {
      await parentService.assertOwnsChild(req.auth.userId, studentId as string);
    }
    const grades = await gradeService.list(
      req.auth.schoolId,
      {
        classId: classId as string | undefined,
        studentId: studentId as string | undefined,
        subjectId: subjectId as string | undefined,
        term: term as string | undefined,
        academicYear: academicYear as string | undefined,
      },
      { onlyValidated: req.auth.role === "PARENT" }
    );
    res.json({ success: true, data: grades });
  }),

  create: asyncHandler(async (req: Request, res: Response) => {
    const input = createGradeSchema.parse(req.body);
    if (req.auth!.role === "TEACHER") {
      await teacherService.assertAssigned(req.auth!.schoolId, req.auth!.userId, input.classId, input.subjectId);
    }
    const grade = await gradeService.create(req.auth!.schoolId, req.auth!.userId, input, req.auth!.role);

    // Si saisie directement par ADMIN/SURVEILLANT, la note est validée d'emblée : on notifie
    // immédiatement. Si saisie par un professeur, elle reste "en attente" — la notification
    // ne partira qu'au moment où le surveillant validera toute la classe.
    if (req.auth!.role !== "TEACHER") {
      await notificationService.notifyParentsOfStudent(
        req.auth!.schoolId,
        input.studentId,
        "NOTE",
        "Nouvelle note",
        `Une note de ${input.value}/${input.maxValue} a été ajoutée.`
      );
    }

    res.status(201).json({ success: true, data: grade });
  }),

  createBatch: asyncHandler(async (req: Request, res: Response) => {
    const batch = createGradeBatchSchema.parse(req.body);
    if (req.auth!.role === "TEACHER") {
      await teacherService.assertAssigned(req.auth!.schoolId, req.auth!.userId, batch.classId, batch.subjectId);
    }
    const grades = await gradeService.createBatch(req.auth!.schoolId, req.auth!.userId, batch, req.auth!.role);

    if (req.auth!.role !== "TEACHER") {
      for (const grade of grades) {
        await notificationService.notifyParentsOfStudent(
          req.auth!.schoolId,
          grade.studentId,
          "NOTE",
          "Nouvelle note",
          `Une note de ${grade.value}/${grade.maxValue} a été ajoutée.`
        );
      }
    } else {
      // Une seule notification groupée au surveillant/admin, pas une par élève.
      const [cls, subject] = await Promise.all([
        prisma.class.findUnique({ where: { id: batch.classId } }),
        prisma.subject.findUnique({ where: { id: batch.subjectId } }),
      ]);
      await notificationService.notifyStaffValidators(
        req.auth!.schoolId,
        "Notes en attente de validation",
        `${grades.length} note(s) "${batch.label}" soumises pour ${cls?.name ?? "une classe"} · ${subject?.name ?? ""} — à valider.`
      );
    }

    res.status(201).json({ success: true, data: grades });
  }),

  update: asyncHandler(async (req: Request, res: Response) => {
    const input = updateGradeSchema.parse(req.body);

    if (req.auth!.role === "TEACHER") {
      const grade = await prisma.grade.findFirst({ where: { id: req.params.id, schoolId: req.auth!.schoolId } });
      if (!grade) throw ApiError.notFound("Note introuvable");
      await teacherService.assertAssigned(req.auth!.schoolId, req.auth!.userId, grade.classId, grade.subjectId);
    }

    const grade = await gradeService.update(req.auth!.schoolId, req.params.id, req.auth!.userId, input, req.auth!.role);
    res.json({ success: true, data: grade });
  }),

  remove: asyncHandler(async (req: Request, res: Response) => {
    await gradeService.remove(req.auth!.schoolId, req.params.id, req.auth!.userId);
    res.status(204).send();
  }),

  auditLog: asyncHandler(async (req: Request, res: Response) => {
    const logs = await gradeService.listAuditLog(req.auth!.schoolId);
    res.json({ success: true, data: logs });
  }),

  teacherStats: asyncHandler(async (req: Request, res: Response) => {
    const { classId, subjectId, term, academicYear } = req.query;
    if (req.auth!.role === "TEACHER") {
      await teacherService.assertAssigned(req.auth!.schoolId, req.auth!.userId, classId as string, subjectId as string);
    }
    const stats = await gradeService.computeTeacherStats(
      req.auth!.schoolId,
      classId as string,
      subjectId as string,
      term as string,
      academicYear as string
    );
    res.json({ success: true, data: stats });
  }),

  schoolStats: asyncHandler(async (req: Request, res: Response) => {
    const { term, academicYear } = req.query;
    const stats = await gradeService.computeSchoolStats(req.auth!.schoolId, term as string, academicYear as string);
    res.json({ success: true, data: stats });
  }),

  repeaters: asyncHandler(async (req: Request, res: Response) => {
    const { academicYear } = req.query;
    const result = await gradeService.computeRepeatersForClass(req.auth!.schoolId, req.params.classId, academicYear as string);
    res.json({ success: true, data: result });
  }),

  auditLogForGrade: asyncHandler(async (req: Request, res: Response) => {
    const logs = await gradeService.auditLogForGrade(req.auth!.schoolId, req.params.id);
    res.json({ success: true, data: logs });
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

  classAverageOnly: asyncHandler(async (req: Request, res: Response) => {
    const { term, academicYear } = req.query;
    const result = await gradeService.computeClassAverageOnly(
      req.auth!.schoolId,
      req.params.classId,
      term as string,
      academicYear as string
    );
    res.json({ success: true, data: result });
  }),
};
