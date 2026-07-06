import { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { classService } from "../services/class.service";
import { createClassSchema, updateClassSchema, assignSubjectToClassSchema } from "../validators/misc.validator";

export const classController = {
  list: asyncHandler(async (req: Request, res: Response) => {
    const classes = await classService.list(req.auth!.schoolId, req.query.academicYear as string | undefined);
    res.json({ success: true, data: classes });
  }),

  getById: asyncHandler(async (req: Request, res: Response) => {
    const cls = await classService.getById(req.auth!.schoolId, req.params.id);
    res.json({ success: true, data: cls });
  }),

  create: asyncHandler(async (req: Request, res: Response) => {
    const input = createClassSchema.parse(req.body);
    const cls = await classService.create(req.auth!.schoolId, input);
    res.status(201).json({ success: true, data: cls });
  }),

  update: asyncHandler(async (req: Request, res: Response) => {
    const input = updateClassSchema.parse(req.body);
    const cls = await classService.update(req.auth!.schoolId, req.params.id, input);
    res.json({ success: true, data: cls });
  }),

  remove: asyncHandler(async (req: Request, res: Response) => {
    await classService.remove(req.auth!.schoolId, req.params.id);
    res.status(204).send();
  }),

  assignSubject: asyncHandler(async (req: Request, res: Response) => {
    const input = assignSubjectToClassSchema.parse(req.body);
    const result = await classService.assignSubject(req.auth!.schoolId, req.params.id, input.subjectId, input.coefficient);
    res.status(201).json({ success: true, data: result });
  }),

  removeSubject: asyncHandler(async (req: Request, res: Response) => {
    await classService.removeSubject(req.auth!.schoolId, req.params.id, req.params.subjectId);
    res.status(204).send();
  }),

  stats: asyncHandler(async (req: Request, res: Response) => {
    const { term, academicYear } = req.query;
    const stats = await classService.getStats(req.auth!.schoolId, req.params.id, term as string, academicYear as string);
    res.json({ success: true, data: stats });
  }),
};
