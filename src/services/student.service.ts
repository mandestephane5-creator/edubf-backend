import { prisma } from "../config/db";
import { ApiError } from "../utils/ApiError";
import { hashPassword } from "../utils/password";
import { generatePin } from "../utils/credentials";
import { CreateStudentWithParentInput, UpdateStudentInput } from "../validators/student.validator";

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
  async createWithParent(schoolId: string, input: CreateStudentWithParentInput) {
    if (input.student.classId) {
      const classExists = await prisma.class.findFirst({ where: { id: input.student.classId, schoolId } });
      if (!classExists) throw ApiError.badRequest("Classe invalide pour cette école");
    }

    const matricule = await generateMatricule(schoolId);

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
          data: { schoolId, phone: input.parent.phone, password: hashed, role: "PARENT" },
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
