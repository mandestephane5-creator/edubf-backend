import { prisma } from "../config/db";
import { ApiError } from "../utils/ApiError";
import { hashPassword } from "../utils/password";
import { generateStaffPassword } from "../utils/credentials";

export const teacherService = {
  /** Liste tous les professeurs de l'école, avec leurs assignations classe+matière */
  async list(schoolId: string) {
    const teachers = await prisma.user.findMany({
      where: { schoolId, role: "TEACHER" },
      include: {
        teacherAssignments: { include: { class: true, subject: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    return teachers.map((t) => ({
      id: t.id,
      email: t.email,
      firstName: t.firstName,
      lastName: t.lastName,
      isActive: t.isActive,
      createdAt: t.createdAt,
      assignments: t.teacherAssignments.map((a) => ({
        id: a.id,
        classId: a.classId,
        className: a.class.name,
        subjectId: a.subjectId,
        subjectName: a.subject.name,
      })),
    }));
  },

  /** Crée un compte professeur avec un mot de passe généré, affiché une seule fois */
  async create(
    schoolId: string,
    input: { email: string; firstName: string; lastName: string; assignments: { classId: string; subjectId: string }[] }
  ) {
    const existing = await prisma.user.findUnique({
      where: { schoolId_email: { schoolId, email: input.email } },
    });
    if (existing) throw ApiError.conflict("Un compte existe déjà avec cet email");

    const tempPassword = generateStaffPassword();
    const hashed = await hashPassword(tempPassword);

    const teacher = await prisma.user.create({
      data: {
        schoolId,
        email: input.email,
        password: hashed,
        role: "TEACHER",
        firstName: input.firstName,
        lastName: input.lastName,
        mustChangePassword: true,
        teacherAssignments: {
          create: input.assignments.map((a) => ({ schoolId, classId: a.classId, subjectId: a.subjectId })),
        },
      },
    });

    return { id: teacher.id, email: teacher.email, tempPassword, firstName: teacher.firstName, lastName: teacher.lastName };
  },

  /** Remplace entièrement les assignations classe+matière d'un professeur */
  async updateAssignments(schoolId: string, teacherId: string, assignments: { classId: string; subjectId: string }[]) {
    const teacher = await prisma.user.findFirst({ where: { id: teacherId, schoolId, role: "TEACHER" } });
    if (!teacher) throw ApiError.notFound("Professeur introuvable");

    await prisma.$transaction([
      prisma.teacherAssignment.deleteMany({ where: { userId: teacherId } }),
      prisma.teacherAssignment.createMany({
        data: assignments.map((a) => ({ schoolId, userId: teacherId, classId: a.classId, subjectId: a.subjectId })),
      }),
    ]);
    return this.list(schoolId).then((list) => list.find((t) => t.id === teacherId));
  },

  /** Active/désactive un compte professeur (ex: fin de contrat) sans le supprimer */
  async setActive(schoolId: string, teacherId: string, isActive: boolean) {
    const teacher = await prisma.user.findFirst({ where: { id: teacherId, schoolId, role: "TEACHER" } });
    if (!teacher) throw ApiError.notFound("Professeur introuvable");
    await prisma.user.update({ where: { id: teacherId }, data: { isActive } });
    return { id: teacherId, isActive };
  },

  /** Les assignations classe+matière du professeur actuellement connecté (pour ses propres onglets) */
  async myAssignments(schoolId: string, userId: string) {
    const assignments = await prisma.teacherAssignment.findMany({
      where: { schoolId, userId },
      include: { class: true, subject: true },
      orderBy: [{ class: { name: "asc" } }, { subject: { name: "asc" } }],
    });
    return assignments.map((a) => ({
      classId: a.classId,
      className: a.class.name,
      subjectId: a.subjectId,
      subjectName: a.subject.name,
    }));
  },

  /** Vérifie que le professeur est bien assigné à cette classe+matière avant de le laisser saisir */
  async assertAssigned(schoolId: string, userId: string, classId: string, subjectId: string) {
    const assignment = await prisma.teacherAssignment.findFirst({
      where: { schoolId, userId, classId, subjectId },
    });
    if (!assignment) throw ApiError.forbidden("Vous n'êtes pas assigné à cette classe pour cette matière");
  },
};
