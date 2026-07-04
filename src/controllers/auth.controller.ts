import { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { authService } from "../services/auth.service";
import {
  registerSchoolSchema,
  loginSchema,
  refreshSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  changeParentPasswordSchema,
} from "../validators/auth.validator";
import { ApiError } from "../utils/ApiError";

export const authController = {
  registerSchool: asyncHandler(async (req: Request, res: Response) => {
    const input = registerSchoolSchema.parse(req.body);
    const result = await authService.registerSchool(input);
    res.status(201).json({ success: true, data: result });
  }),

  login: asyncHandler(async (req: Request, res: Response) => {
    const input = loginSchema.parse(req.body);
    const result = await authService.login(input);
    res.status(200).json({ success: true, data: result });
  }),

  refresh: asyncHandler(async (req: Request, res: Response) => {
    const { refreshToken } = refreshSchema.parse(req.body);
    const result = await authService.refresh(refreshToken);
    res.status(200).json({ success: true, data: result });
  }),

  logout: asyncHandler(async (req: Request, res: Response) => {
    if (!req.auth) throw ApiError.unauthorized();
    await authService.logout(req.auth.userId);
    res.status(200).json({ success: true, message: "Déconnexion réussie" });
  }),

  me: asyncHandler(async (req: Request, res: Response) => {
    if (!req.auth) throw ApiError.unauthorized();
    const user = await authService.me(req.auth.userId);
    res.status(200).json({ success: true, data: user });
  }),

  forgotPassword: asyncHandler(async (req: Request, res: Response) => {
    const { schoolSlug, email } = forgotPasswordSchema.parse(req.body);
    await authService.forgotPassword(schoolSlug, email);
    // Réponse identique que le compte existe ou non, pour ne pas révéler d'information
    res.status(200).json({ success: true, message: "Si ce compte existe, un email a été envoyé." });
  }),

  resetPassword: asyncHandler(async (req: Request, res: Response) => {
    const { token, newPassword } = resetPasswordSchema.parse(req.body);
    await authService.resetPassword(token, newPassword);
    res.status(200).json({ success: true, message: "Mot de passe mis à jour." });
  }),

  changeParentPassword: asyncHandler(async (req: Request, res: Response) => {
    if (!req.auth) throw ApiError.unauthorized();
    const { currentPassword, newPassword } = changeParentPasswordSchema.parse(req.body);
    await authService.changeParentPassword(req.auth.userId, currentPassword, newPassword);
    res.status(200).json({ success: true, message: "Mot de passe mis à jour." });
  }),
};
