import { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { incidentService } from "../services/incident.service";
import { notificationService } from "../services/notification.service";
import { parentService } from "../services/parent.service";
import { ApiError } from "../utils/ApiError";
import { createIncidentSchema } from "../validators/academic.validator";

const LABELS: Record<string, string> = {
  ABSENCE: "Absence",
  RETARD: "Retard",
  EXPULSION: "Expulsion",
};

export const incidentController = {
  list: asyncHandler(async (req: Request, res: Response) => {
    const { classId, studentId, month } = req.query;
    if (!req.auth) throw ApiError.unauthorized();
    if (req.auth.role === "PARENT" && studentId) {
      await parentService.assertOwnsChild(req.auth.userId, studentId as string);
    }
    const incidents = await incidentService.list(req.auth.schoolId, {
      classId: classId as string | undefined,
      studentId: studentId as string | undefined,
      month: month as string | undefined,
    });
    res.json({ success: true, data: incidents });
  }),

  create: asyncHandler(async (req: Request, res: Response) => {
    const input = createIncidentSchema.parse(req.body);
    const incident = await incidentService.create(req.auth!.schoolId, req.auth!.userId, input);

    await notificationService.notifyParentsOfStudent(
      req.auth!.schoolId,
      input.studentId,
      "INCIDENT",
      LABELS[input.type],
      `${LABELS[input.type]} enregistrée le ${new Date(input.date).toLocaleDateString("fr-FR")}.`
    );

    res.status(201).json({ success: true, data: incident });
  }),

  update: asyncHandler(async (req: Request, res: Response) => {
    const incident = await incidentService.update(req.auth!.schoolId, req.params.id, req.body);
    res.json({ success: true, data: incident });
  }),

  remove: asyncHandler(async (req: Request, res: Response) => {
    await incidentService.remove(req.auth!.schoolId, req.params.id);
    res.status(204).send();
  }),
};
