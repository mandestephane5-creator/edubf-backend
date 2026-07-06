import { prisma } from "../config/db";
import { ApiError } from "../utils/ApiError";
import { hashPassword } from "../utils/password";
import { generatePin } from "../utils/credentials";
import { CreateStudentWithParentInput, UpdateStudentInput, BulkCreateStudentsInput } from "../validators/student.validator";

async function generateMatricule(schoolId: string): Promise<string> {
  const year = new Date().getFullYear();
  const count = await prisma.student.count({ where: { schoolId } });
  const sequence = String(count + 1).padStart(6, "0");
  return `EDU-${year}-${sequence}`;
}

export const studentService = {
  async list(schoolId: string, filters: { classId?: string; search?: string }) {
    return prisma.student.findMany({
      where: {
        schoolId,
        classId: filters.classId,
        ...(filters.search && {
          OR: [
            { firstName: { contains: filters.search, mode: "insensitive" } },
            { lastName: { contains: filters.search, mode: "insensitive" } },
            { matricule: { contains: filters.search, mode: "insensitive" } },
          ],
        }),
      },
      include: { class: true, parents: { include: { parent: true } } },
      orderBy: { lastName: "asc" },
    });
  },

  async getById(schoolId: string, id: string) {
    const student = await prisma.student.findFirst({
      where: { id, schoolId },
      include: { class: true, parents: { include: { parent: { include: { user: true } } } } },
    });
    if (!student) throw ApiError.notFound("Élève introuvable");
    return student;
  },

  /**
   * Vérifie si un numéro de téléphone correspond déjà à un parent existant dans l'école.
   * Utilisé par le frontend pour proposer une confirmation avant de créer un doublon.
   */
  async findExistingParentByPhone(schoolId: string, phone: string) {
    const user = await prisma.user.findUnique({
      where: { schoolId_phone: { schoolId, phone } },
      include: { parent: { include: { children: { include: { student: true } } } } },
    });
    return user?.parent ?? null;
  },

  /**
   * Création combinée élève + parent en une seule étape.
   * Si `linkToExistingParentId` est fourni, relie l'élève à ce parent existant
   * (après confirmation) au lieu de créer un nouveau compte.
   */
  async createWithParent(schoolId: string, input: CreateStudentWithParentInput, precomputedMatricule?: string) {
    if (input.student.classId) {
      const classExists = await prisma.class.findFirst({ where: { id: input.student.classId, schoolId } });
      if (!classExists) throw ApiError.badRequest("Classe invalide pour cette école");
    }

    const matricule = precomputedMatricule ?? (await generateMatricule(schoolId));

    return prisma.$transaction(async (tx) => {
      let parentId: string;
      let generatedPassword: string | undefined;

      if (input.linkToExistingParentId) {
        const existingParent = await tx.parent.findFirst({
          where: { id: input.linkToExistingParentId, schoolId },
        });
        if (!existingParent) throw ApiError.badRequest("Parent existant introuvable");
        parentId = existingParent.id;
      } else {
        const existingPhone = await tx.user.findUnique({
          where: { schoolId_phone: { schoolId, phone: input.parent.phone } },
        });
        if (existingPhone) {
          throw ApiError.conflict(
            "PHONE_ALREADY_EXISTS: Ce numéro correspond déjà à un parent existant. Confirmez le rattachement."
          );
        }

        generatedPassword = generatePin();
        const hashed = await hashPassword(generatedPassword);
        const parentUser = await tx.user.create({
          data: { schoolId, phone: input.parent.phone, password: hashed, role: "PARENT", mustChangePassword: true },
        });
        const parent = await tx.parent.create({
          data: {
            schoolId,
            userId: parentUser.id,
            firstName: input.parent.firstName,
            lastName: input.parent.lastName,
          },
        });
        parentId = parent.id;
      }

      const student = await tx.student.create({
        data: {
          schoolId,
          matricule,
          firstName: input.student.firstName,
          lastName: input.student.lastName,
          birthDate: input.student.birthDate,
          gender: input.student.gender,
          classId: input.student.classId,
          parents: { create: { parentId } },
        },
        include: { class: true },
      });

      return { student, matricule, parentPassword: generatedPassword };
    });
  },

  /**
   * Import en masse : une ligne = un élève + son parent. Traite chaque ligne
   * indépendamment (une erreur sur une ligne n'empêche pas les autres de passer),
   * et détecte automatiquement les doublons de téléphone (relie sans demander
   * de confirmation — acceptable en import de masse, contrairement à la création
   * unitaire où on demande confirmation à l'écran).
   */
  /**
   * Import en masse : une ligne = un élève + son parent. Traite les lignes par petits
   * groupes en parallèle (plus rapide qu'une par une), sans risque de collision de
   * matricule : les matricules sont calculés à l'avance en une seule fois, plutôt que
   * recalculés à la volée pendant des écritures concurrentes.
   */
  async bulkCreate(schoolId: string, input: BulkCreateStudentsInput) {
    const classes = await prisma.class.findMany({ where: { schoolId } });
    const classIdByName = new Map(classes.map((c) => [c.name.trim().toLowerCase(), c.id]));

    const year = new Date().getFullYear();
    const startingCount = await prisma.student.count({ where: { schoolId } });

    const results: Array<{
      success: boolean;
      studentName: string;
      matricule?: string;
      parentPassword?: string;
      parentPhone?: string;
      error?: string;
    }> = [];

    const BATCH_SIZE = 5;
    for (let batchStart = 0; batchStart < input.rows.length; batchStart += BATCH_SIZE) {
      const batch = input.rows.slice(batchStart, batchStart + BATCH_SIZE);

      const batchResults = await Promise.all(
        batch.map(async (row, indexInBatch) => {
          const rowIndex = batchStart + indexInBatch;
          const studentName = `${row.studentFirstName} ${row.studentLastName}`;
          const matricule = `EDU-${year}-${String(startingCount + rowIndex + 1).padStart(6, "0")}`;

          try {
            let classId: string | undefined;
            if (row.className) {
              classId = classIdByName.get(row.className.trim().toLowerCase());
              if (!classId) throw new Error(`Classe "${row.className}" introuvable`);
            }

            const existingUser = await prisma.user.findUnique({
              where: { schoolId_phone: { schoolId, phone: row.parentPhone } },
            });
            let linkToExistingParentId: string | undefined;
            if (existingUser) {
              const existingParent = await prisma.parent.findUnique({ where: { userId: existingUser.id } });
              linkToExistingParentId = existingParent?.id;
            }

            const result = await this.createWithParent(
              schoolId,
              {
                student: {
                  firstName: row.studentFirstName,
                  lastName: row.studentLastName,
                  birthDate: row.birthDate ? new Date(row.birthDate) : undefined,
                  classId,
                },
                parent: {
                  firstName: row.parentFirstName,
                  lastName: row.parentLastName,
                  phone: row.parentPhone,
                },
                linkToExistingParentId,
              },
              matricule
            );

            return {
              success: true,
              studentName,
              matricule: result.matricule,
              parentPassword: result.parentPassword,
              parentPhone: row.parentPhone,
            };
          } catch (err: any) {
            return { success: false, studentName, error: err.message };
          }
        })
      );

      results.push(...batchResults);
    }

    return results;
  },

  async update(schoolId: string, id: string, input: UpdateStudentInput) {
    await this.getById(schoolId, id);
    return prisma.student.update({ where: { id }, data: input, include: { class: true } });
  },

  async remove(schoolId: string, id: string) {
    await this.getById(schoolId, id);
    return prisma.student.delete({ where: { id } });
  },

  async getGrades(schoolId: string, studentId: string, academicYear?: string) {
    await this.getById(schoolId, studentId);
    return prisma.grade.findMany({
      where: { schoolId, studentId, ...(academicYear && { academicYear }) },
      include: { subject: true },
      orderBy: [{ term: "asc" }, { createdAt: "desc" }],
    });
  },

  async getIncidents(schoolId: string, studentId: string, month?: string) {
    await this.getById(schoolId, studentId);
    const dateFilter = month
      ? { date: { gte: new Date(`${month}-01`), lt: new Date(new Date(`${month}-01`).setMonth(new Date(`${month}-01`).getMonth() + 1)) } }
      : {};
    return prisma.incident.findMany({
      where: { schoolId, studentId, ...dateFilter },
      include: { subject: true },
      orderBy: { date: "desc" },
    });
  },
};
