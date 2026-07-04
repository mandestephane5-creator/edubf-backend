import { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { subjectService } from "../services/subject.service";
import { createSubjectSchema, updateSubjectSchema } from "../validators/misc.validator";

export const subjectController = {
  list: asyncHandler(async (req: Request, res: Response) => {
    const subjects = await subjectService.list(req.auth!.schoolId);
    res.json({ success: true, data: subjects });
  }),

  create: asyncHandler(async (req: Request, res: Response) => {
    const input = createSubjectSchema.parse(req.body);
    const subject = await subjectService.create(req.auth!.schoolId, input);
    res.status(201).json({ success: true, data: subject });
  }),

  update: asyncHandler(async (req: Request, res: Response) => {
    const input = updateSubjectSchema.parse(req.body);
    const subject = await subjectService.update(req.auth!.schoolId, req.params.id, input);
    res.json({ success: true, data: subject });
  }),

  remove: asyncHandler(async (req: Request, res: Response) => {
    await subjectService.remove(req.auth!.schoolId, req.params.id);
    res.status(204).send();
  }),
};
