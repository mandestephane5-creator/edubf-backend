import { prisma } from "../config/db";

export const attendanceService = {
  /** Présence du jour pour une classe — pré-rempli avec les élèves de la classe */
  async getForClassAndDate(schoolId: string, classId: string, date: Date) {
    const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const dayEnd = new Date(dayStart);
    dayEnd.setDate(dayEnd.getDate() + 1);

    const [students, existing] = await Promise.all([
      prisma.student.findMany({ where: { schoolId, classId }, orderBy: { lastName: "asc" } }),
      prisma.dailyAttendance.findMany({ where: { schoolId, classId, date: { gte: dayStart, lt: dayEnd } } }),
    ]);

    const existingByStudent = new Map(existing.map((a) => [a.studentId, a.present]));
    return students.map((s) => ({
      studentId: s.id,
      firstName: s.firstName,
      lastName: s.lastName,
      present: existingByStudent.has(s.id) ? existingByStudent.get(s.id) : null, // null = pas encore renseigné
    }));
  },

  /** Enregistre (ou met à jour) la présence de toute une classe pour une date donnée */
  async markForClass(
    schoolId: string,
    classId: string,
    date: Date,
    records: { studentId: string; present: boolean }[],
    recordedByUserId: string
  ) {
    const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());

    await prisma.$transaction(
      records.map((r) =>
        prisma.dailyAttendance.upsert({
          where: { studentId_date: { studentId: r.studentId, date: dayStart } },
          update: { present: r.present, recordedByUserId },
          create: { schoolId, classId, studentId: r.studentId, date: dayStart, present: r.present, recordedByUserId },
        })
      )
    );
    return { updated: records.length };
  },

  /** Historique de présence d'un élève (vue parent) */
  async getForStudent(schoolId: string, studentId: string, fromDate?: Date) {
    return prisma.dailyAttendance.findMany({
      where: { schoolId, studentId, ...(fromDate && { date: { gte: fromDate } }) },
      orderBy: { date: "desc" },
      take: 60,
    });
  },
};
