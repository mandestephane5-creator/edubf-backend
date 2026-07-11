import { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { studentService } from "../services/student.service";
import { parentService } from "../services/parent.service";
import {
  createStudentWithParentSchema,
  updateStudentSchema,
  bulkCreateStudentsSchema,
} from "../validators/student.validator";
import { ApiError } from "../utils/ApiError";
import { prisma } from "../config/db";

export const studentController = {
  list: asyncHandler(async (req: Request, res: Response) => {
    const { classId, search } = req.query;

    // Sécurité : un professeur ne doit voir que les élèves des classes qui lui sont
    // assignées — jamais n'importe quelle classe de l'école en changeant classId.
    if (req.auth!.role === "TEACHER") {
      if (!classId) throw ApiError.badRequest("classId requis pour un professeur");
      const assignment = await prisma.teacherAssignment.findFirst({
        where: { schoolId: req.auth!.schoolId, userId: req.auth!.userId, classId: classId as string },
      });
      if (!assignment) throw ApiError.forbidden("Vous n'êtes pas assigné à cette classe");
    }

    const students = await studentService.list(req.auth!.schoolId, {
      classId: classId as string | undefined,
      search: search as string | undefined,
    });
    res.json({ success: true, data: students });
  }),

  getById: asyncHandler(async (req: Request, res: Response) => {
    const student = await studentService.getById(req.auth!.schoolId, req.params.id);
    res.json({ success: true, data: student });
  }),

  /**
   * Vérifie si le téléphone renseigné correspond à un parent existant.
   * Appelé par le frontend AVANT la création pour proposer une confirmation.
   */
  checkParentPhone: asyncHandler(async (req: Request, res: Response) => {
    const { phone } = req.query;
    const existing = await studentService.findExistingParentByPhone(req.auth!.schoolId, phone as string);
    res.json({ success: true, data: existing });
  }),

  create: asyncHandler(async (req: Request, res: Response) => {
    const input = createStudentWithParentSchema.parse(req.body);
    try {
      const result = await studentService.createWithParent(req.auth!.schoolId, input);
      res.status(201).json({ success: true, data: result });
    } catch (err: any) {
      if (err.message?.startsWith("PHONE_ALREADY_EXISTS")) {
        return res.status(409).json({ success: false, code: "PHONE_ALREADY_EXISTS", message: err.message });
      }
      throw err;
    }
  }),

  bulkCreate: asyncHandler(async (req: Request, res: Response) => {
    const input = bulkCreateStudentsSchema.parse(req.body);
    const results = await studentService.bulkCreate(req.auth!.schoolId, input);
    res.status(201).json({ success: true, data: results });
  }),

  update: asyncHandler(async (req: Request, res: Response) => {
    const input = updateStudentSchema.parse(req.body);
    const student = await studentService.update(req.auth!.schoolId, req.params.id, input);
    res.json({ success: true, data: student });
  }),

  remove: asyncHandler(async (req: Request, res: Response) => {
    await studentService.remove(req.auth!.schoolId, req.params.id);
    res.status(204).send();
  }),

  getGrades: asyncHandler(async (req: Request, res: Response) => {
    if (!req.auth) throw ApiError.unauthorized();
    if (req.auth.role === "PARENT") await parentService.assertOwnsChild(req.auth.userId, req.params.id);
    const grades = await studentService.getGrades(
      req.auth.schoolId,
      req.params.id,
      req.query.academicYear as string | undefined
    );
    res.json({ success: true, data: grades });
  }),

  getIncidents: asyncHandler(async (req: Request, res: Response) => {
    if (!req.auth) throw ApiError.unauthorized();
    if (req.auth.role === "PARENT") await parentService.assertOwnsChild(req.auth.userId, req.params.id);
    const incidents = await studentService.getIncidents(
      req.auth.schoolId,
      req.params.id,
      req.query.month as string | undefined
    );
    res.json({ success: true, data: incidents });
  }),
};
