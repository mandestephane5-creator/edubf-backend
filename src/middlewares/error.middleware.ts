import { NextFunction, Request, Response } from "express";
import { Prisma } from "@prisma/client";
import { ZodError } from "zod";
import { ApiError } from "../utils/ApiError";

export function notFoundMiddleware(req: Request, res: Response) {
  res.status(404).json({
    success: false,
    message: `Route introuvable: ${req.method} ${req.originalUrl}`,
  });
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorMiddleware(err: unknown, req: Request, res: Response, _next: NextFunction) {
  // Erreurs métier explicites
  if (err instanceof ApiError) {
    return res.status(err.statusCode).json({
      success: false,
      message: err.message,
      details: err.details,
    });
  }

  // Erreurs de validation Zod
  if (err instanceof ZodError) {
    return res.status(400).json({
      success: false,
      message: "Erreur de validation",
      details: err.flatten(),
    });
  }

  // Erreurs Prisma connues (contrainte unique, clé étrangère, etc.)
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P2002") {
      return res.status(409).json({
        success: false,
        message: "Une ressource avec ces informations existe déjà",
        details: err.meta,
      });
    }
    if (err.code === "P2025") {
      return res.status(404).json({
        success: false,
        message: "Ressource introuvable",
      });
    }
  }

  // Erreur inconnue
  console.error("[EduBF] Erreur non gérée:", err);
  return res.status(500).json({
    success: false,
    message: "Erreur interne du serveur",
  });
}
