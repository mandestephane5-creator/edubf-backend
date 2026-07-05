import { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { parentService } from "../services/parent.service";
import { linkExistingChildSchema } from "../validators/auth.validator";
import { ApiError } from "../utils/ApiError";

export const parentController = {
  list: asyncHandler(async (req: Request, res: Response) => {
    const parents = await parentService.list(req.auth!.schoolId, req.query.search as string | undefined);
    res.json({ success: true, data: parents });
  }),

  getById: asyncHandler(async (req: Request, res: Response) => {
    const parent = await parentService.getById(req.auth!.schoolId, req.params.id);
    res.json({ success: true, data: parent });
  }),

  myChildren: asyncHandler(async (req: Request, res: Response) => {
    if (!req.auth) throw ApiError.unauthorized();
    const children = await parentService.getMyChildren(req.auth.userId);
    res.json({ success: true, data: children });
  }),

  resetPassword: asyncHandler(async (req: Request, res: Response) => {
    const result = await parentService.resetPassword(req.auth!.schoolId, req.params.id);
    res.json({ success: true, data: result });
  }),

  linkExistingChild: asyncHandler(async (req: Request, res: Response) => {
    if (!req.auth) throw ApiError.unauthorized();
    const { matricule, password } = linkExistingChildSchema.parse(req.body);
    const child = await parentService.linkExistingChild(req.auth.schoolId, req.auth.userId, matricule, password);
    res.status(201).json({ success: true, data: child });
  }),
};
