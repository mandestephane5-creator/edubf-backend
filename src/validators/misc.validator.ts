import { z } from "zod";

// ---- Surveillant (créé par l'admin) ----
export const createSurveillantSchema = z.object({
  email: z.string().email(),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
});

// ---- Classe ----
export const createClassSchema = z.object({
  name: z.string().min(1),
  level: z.string().min(1),
  academicYear: z.string().min(4),
});
export const updateClassSchema = createClassSchema.partial();

// ---- Matière ----
export const createSubjectSchema = z.object({
  name: z.string().min(1),
  code: z.string().optional(),
});
export const updateSubjectSchema = createSubjectSchema.partial();

export const assignSubjectToClassSchema = z.object({
  subjectId: z.string().uuid(),
  coefficient: z.number().min(0.5).max(10).default(1),
});

// ---- Paramètres école ----
export const updateSchoolSettingsSchema = z.object({
  name: z.string().min(1).optional(),
  city: z.string().optional(),
  phone: z.string().optional(),
  adminPhone: z.string().optional(),
  surveillancePhone: z.string().optional(),
  secretariatHours: z.string().optional(),
  address: z.string().optional(),
  publicWebsiteUrl: z.string().url().optional().or(z.literal("")),
});

export type CreateSurveillantInput = z.infer<typeof createSurveillantSchema>;
export type CreateClassInput = z.infer<typeof createClassSchema>;
export type CreateSubjectInput = z.infer<typeof createSubjectSchema>;

// ---- Annonces (actualités de l'école) ----
export const createAnnouncementSchema = z.object({
  title: z.string().min(1),
  message: z.string().min(1),
});

// ---- Signalements ----
export const createReportSchema = z.object({
  message: z.string().min(3, "Décris le problème (3 caractères minimum)"),
});

// ---- Jetons de notifications push ----
export const registerPushTokenSchema = z.object({
  token: z.string().min(5),
});
