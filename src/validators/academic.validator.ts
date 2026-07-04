import { z } from "zod";

export const termEnum = z.enum(["TRIMESTRE_1", "TRIMESTRE_2", "TRIMESTRE_3"]);
export const dayOfWeekEnum = z.enum(["LUNDI", "MARDI", "MERCREDI", "JEUDI", "VENDREDI", "SAMEDI", "DIMANCHE"]);
export const incidentTypeEnum = z.enum(["ABSENCE", "RETARD", "EXPULSION"]);

// ---- Notes ----
export const createGradeSchema = z.object({
  studentId: z.string().uuid(),
  classId: z.string().uuid(),
  subjectId: z.string().uuid(),
  value: z.number().min(0),
  maxValue: z.number().min(1).default(20),
  coefficient: z.number().min(0.5).max(10).default(1),
  term: termEnum,
  academicYear: z.string().min(4),
  label: z.string().optional(),
});
export const updateGradeSchema = createGradeSchema.partial();

// ---- Incidents ----
// Absence/Retard: date uniquement. Expulsion: date + heure + matière + motif.
export const createIncidentSchema = z
  .object({
    studentId: z.string().uuid(),
    type: incidentTypeEnum,
    date: z.coerce.date(),
    time: z.string().optional(),
    subjectId: z.string().uuid().optional(),
    motif: z.string().optional(),
  })
  .refine((data) => data.type !== "EXPULSION" || (data.time && data.subjectId && data.motif), {
    message: "Une expulsion nécessite l'heure, la matière et le motif",
    path: ["type"],
  });

// ---- Emploi du temps ----
export const createTimetableSlotSchema = z.object({
  classId: z.string().uuid(),
  day: dayOfWeekEnum,
  startHour: z.number().int().min(0).max(23),
  endHour: z.number().int().min(1).max(24),
  subjectId: z.string().uuid(),
});

// ---- Calendrier d'évaluations ----
export const createEvaluationScheduleSchema = z.object({
  classId: z.string().uuid(),
  subjectId: z.string().uuid(),
  label: z.string().min(1), // "Devoir 1", "Devoir 2"
  date: z.coerce.date(),
  term: termEnum,
  academicYear: z.string().min(4),
});

export const createCompositionDateSchema = z.object({
  date: z.coerce.date(),
  term: termEnum,
  academicYear: z.string().min(4),
  label: z.string().optional(),
});

export type CreateGradeInput = z.infer<typeof createGradeSchema>;
export type CreateIncidentInput = z.infer<typeof createIncidentSchema>;
export type CreateTimetableSlotInput = z.infer<typeof createTimetableSlotSchema>;
export type CreateEvaluationScheduleInput = z.infer<typeof createEvaluationScheduleSchema>;
export type CreateCompositionDateInput = z.infer<typeof createCompositionDateSchema>;
