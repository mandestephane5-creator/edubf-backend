export class ApiError extends Error {
  public statusCode: number;
  public details?: unknown;

  constructor(statusCode: number, message: string, details?: unknown) {
    super(message);
    this.statusCode = statusCode;
    this.details = details;
    Object.setPrototypeOf(this, ApiError.prototype);
  }

  static badRequest(message = "Requête invalide", details?: unknown) {
    return new ApiError(400, message, details);
  }
  static unauthorized(message = "Non authentifié") {
    return new ApiError(401, message);
  }
  static forbidden(message = "Accès refusé") {
    return new ApiError(403, message);
  }
  static notFound(message = "Ressource introuvable") {
    return new ApiError(404, message);
  }
  static conflict(message = "Conflit de données") {
    return new ApiError(409, message);
  }
  static internal(message = "Erreur interne du serveur") {
    return new ApiError(500, message);
  }
}
