import { z } from "zod";

// ---- Professeurs ----
export const createTeacherSchema = z.object({
  email: z.string().email(),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  assignments: z
    .array(z.object({ classId: z.string().uuid(), subjectId: z.string().uuid() }))
    .min(1, "Au moins une classe et une matière doivent être assignées"),
});

export const updateTeacherAssignmentsSchema = z.object({
  assignments: z
    .array(z.object({ classId: z.string().uuid(), subjectId: z.string().uuid() }))
    .min(1, "Au moins une classe et une matière doivent être assignées"),
});

// ---- Validation (surveillant) ----
export const validateClassSchema = z.object({
  classId: z.string().uuid(),
});

// ---- Signalement rapide "élève perturbateur" ----
export const createDisruptiveReportSchema = z.object({
  studentId: z.string().uuid(),
});

// ---- Registre de présence ----
export const markAttendanceSchema = z.object({
  classId: z.string().uuid(),
  date: z.coerce.date(),
  records: z
    .array(z.object({ studentId: z.string().uuid(), present: z.boolean() }))
    .min(1),
});

// ---- Calendrier ----
export const createCalendarEventSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  date: z.coerce.date(),
  endDate: z.coerce.date().optional(),
});
export const updateCalendarEventSchema = createCalendarEventSchema.partial();
