import { NextFunction, Request, Response } from "express";
import { z, ZodTypeAny } from "zod";
import { ApiError } from "../utils/ApiError";

/**
 * Valide que les paramètres d'URL (req.params) respectent le schéma donné.
 * Utilisé pour s'assurer que tout identifiant transmis dans l'URL (:id, :classId...)
 * est bien un UUID avant d'atteindre le contrôleur — évite de laisser passer des valeurs
 * arbitraires vers la couche base de données et renvoie une erreur 400 propre plutôt
 * qu'une erreur 500 générique.
 */
export function validateParams(schema: Record<string, ZodTypeAny>) {
  const zodSchema = z.object(schema);
  return (req: Request, _res: Response, next: NextFunction) => {
    const result = zodSchema.safeParse(req.params);
    if (!result.success) {
      return next(ApiError.badRequest("Paramètre d'URL invalide", result.error.flatten()));
    }
    next();
  };
}

/** Raccourci pour le cas le plus fréquent : un seul paramètre `id` en UUID */
export const validateIdParam = validateParams({ id: z.string().uuid("Identifiant invalide") });
