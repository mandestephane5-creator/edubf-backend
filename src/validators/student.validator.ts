import { z } from "zod";

// Création combinée : élève + parent en une seule étape.
// Si `linkToExistingParentId` est fourni, on relie l'élève à ce parent existant
// (après confirmation côté surveillant suite à une détection de doublon de téléphone)
// plutôt que d'en créer un nouveau.
export const createStudentWithParentSchema = z.object({
  student: z.object({
    firstName: z.string().min(1),
    lastName: z.string().min(1),
    birthDate: z.coerce.date().optional(),
    gender: z.enum(["M", "F"]).optional(),
    classId: z.string().uuid().optional(),
  }),
  parent: z.object({
    firstName: z.string().min(1),
    lastName: z.string().min(1),
    phone: z.string().min(8, "Numéro de téléphone invalide"),
  }),
  linkToExistingParentId: z.string().uuid().optional(),
});

export const updateStudentSchema = z.object({
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  birthDate: z.coerce.date().optional(),
  gender: z.enum(["M", "F"]).optional(),
  classId: z.string().uuid().optional(),
});

// Import en masse : une ligne = un élève + son parent. La classe est résolue par son
// nom (pas par ID) puisque le surveillant ne connaît que le nom affiché dans l'interface.
export const bulkCreateStudentsSchema = z.object({
  rows: z.array(
    z.object({
      studentFirstName: z.string().min(1),
      studentLastName: z.string().min(1),
      birthDate: z.string().optional(),
      className: z.string().optional(),
      parentFirstName: z.string().min(1),
      parentLastName: z.string().min(1),
      parentPhone: z.string().min(8),
    })
  ),
});

export type BulkCreateStudentsInput = z.infer<typeof bulkCreateStudentsSchema>;

export type CreateStudentWithParentInput = z.infer<typeof createStudentWithParentSchema>;
export type UpdateStudentInput = z.infer<typeof updateStudentSchema>;
