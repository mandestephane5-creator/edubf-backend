import { z } from "zod";

export const registerSchoolSchema = z.object({
  schoolName: z.string().min(2, "Nom d'école trop court"),
  schoolSlug: z
    .string()
    .min(2)
    .regex(/^[a-z0-9-]+$/, "Le slug doit être en minuscules, chiffres et tirets uniquement"),
  adminEmail: z.string().email("Email invalide"),
  adminPassword: z
    .string()
    .min(8, "Mot de passe trop court (min. 8 caractères)")
    .regex(/[A-Za-z]/, "Le mot de passe doit contenir au moins une lettre")
    .regex(/[0-9]/, "Le mot de passe doit contenir au moins un chiffre"),
  country: z.string().optional(),
  city: z.string().optional(),
  phone: z.string().optional(),
});

// L'identifiant peut être un email (ADMIN/SURVEILLANT) ou le matricule d'un enfant (PARENT)
export const loginSchema = z.object({
  schoolSlug: z.string().min(2, "L'identifiant de l'école est requis"),
  identifier: z.string().min(2, "Email ou matricule requis"),
  password: z.string().min(1, "Mot de passe requis"),
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(10, "Refresh token requis"),
});

export const forgotPasswordSchema = z.object({
  schoolSlug: z.string().min(2),
  email: z.string().email(),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(10),
  newPassword: z
    .string()
    .min(8, "Mot de passe trop court (min. 8 caractères)")
    .regex(/[A-Za-z]/, "Le mot de passe doit contenir au moins une lettre")
    .regex(/[0-9]/, "Le mot de passe doit contenir au moins un chiffre"),
});

// Le parent change son mot de passe (PIN 6 chiffres) après connexion
export const changeParentPasswordSchema = z.object({
  currentPassword: z.string().length(6, "Le mot de passe actuel doit faire 6 chiffres"),
  newPassword: z
    .string()
    .length(6, "Le nouveau mot de passe doit faire exactement 6 chiffres")
    .regex(/^[0-9]+$/, "Le mot de passe doit être composé uniquement de chiffres"),
});

// Ajouter un enfant déjà inscrit à son compte parent (preuve = matricule + mot de passe
// d'un des parents déjà liés, même niveau de preuve qu'une connexion classique)
export const linkExistingChildSchema = z.object({
  matricule: z.string().min(2, "Matricule requis"),
  password: z.string().min(1, "Mot de passe requis"),
});

export type RegisterSchoolInput = z.infer<typeof registerSchoolSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
