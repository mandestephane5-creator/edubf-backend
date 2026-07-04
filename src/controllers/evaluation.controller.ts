import { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { evaluationService } from "../services/evaluation.service";
import { notificationService } from "../services/notification.service";
import { prisma } from "../config/db";
import { createEvaluationScheduleSchema, createCompositionDateSchema } from "../validators/academic.validator";

export const evaluationController = {
  listForClass: asyncHandler(async (req: Request, res: Response) => {
    const { term, academicYear } = req.query;
    const items = await evaluationService.listForClass(
      req.auth!.schoolId,
      req.params.classId,
      term as string | undefined,
      academicYear as string | undefined
    );
    res.json({ success: true, data: items });
  }),

  createDevoir: asyncHandler(async (req: Request, res: Response) => {
    const input = createEvaluationScheduleSchema.parse(req.body);
    const devoir = await evaluationService.createDevoir(req.auth!.schoolId, input);

    // Notifie tous les parents des élèves de la classe concernée
    const students = await prisma.student.findMany({ where: { schoolId: req.auth!.schoolId, classId: input.classId } });
    await Promise.all(
      students.map((s) =>
        notificationService.notifyParentsOfStudent(
          req.auth!.schoolId,
          s.id,
          "EVALUATION",
          input.label,
          `${input.label} programmé le ${new Date(input.date).toLocaleDateString("fr-FR")}.`
        )
      )
    );

    res.status(201).json({ success: true, data: devoir });
  }),

  removeDevoir: asyncHandler(async (req: Request, res: Response) => {
    await evaluationService.removeDevoir(req.auth!.schoolId, req.params.id);
    res.status(204).send();
  }),

  listCompositionDates: asyncHandler(async (req: Request, res: Response) => {
    const { term, academicYear } = req.query;
    const dates = await evaluationService.listCompositionDates(
      req.auth!.schoolId,
      term as string | undefined,
      academicYear as string | undefined
    );
    res.json({ success: true, data: dates });
  }),

  createCompositionDate: asyncHandler(async (req: Request, res: Response) => {
    const input = createCompositionDateSchema.parse(req.body);
    const date = await evaluationService.createCompositionDate(req.auth!.schoolId, input);
    res.status(201).json({ success: true, data: date });
  }),

  removeCompositionDate: asyncHandler(async (req: Request, res: Response) => {
    await evaluationService.removeCompositionDate(req.auth!.schoolId, req.params.id);
    res.status(204).send();
  }),
};
