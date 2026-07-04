import { NextFunction, Request, Response } from "express";
import { Role } from "@prisma/client";
import { ApiError } from "../utils/ApiError";
import { verifyAccessToken, JwtPayload } from "../utils/jwt";

// Étend Express.Request pour porter l'utilisateur authentifié
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      auth?: JwtPayload;
    }
  }
}

/**
 * Vérifie la présence et la validité du token JWT d'accès.
 * Injecte req.auth = { userId, schoolId, role }
 */
export function authenticate(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return next(ApiError.unauthorized("Token d'accès manquant"));
  }

  const token = header.split(" ")[1];
  try {
    const payload = verifyAccessToken(token);
    req.auth = payload;
    next();
  } catch {
    next(ApiError.unauthorized("Token d'accès invalide ou expiré"));
  }
}

/**
 * Restreint l'accès à une liste de rôles autorisés.
 * Usage: router.get('/x', authenticate, authorize('ADMIN', 'SURVEILLANT'), controller)
 */
export function authorize(...allowedRoles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.auth) {
      return next(ApiError.unauthorized());
    }
    if (!allowedRoles.includes(req.auth.role)) {
      return next(ApiError.forbidden("Vous n'avez pas les droits pour cette action"));
    }
    next();
  };
}

/**
 * Garantit que toute requête est bien scopée à l'école (tenant) de l'utilisateur connecté.
 * À utiliser dans les services: toujours filtrer par schoolId = req.auth.schoolId
 */
export function requireSchoolContext(req: Request, _res: Response, next: NextFunction) {
  if (!req.auth?.schoolId) {
    return next(ApiError.forbidden("Contexte école introuvable"));
  }
  next();
}
