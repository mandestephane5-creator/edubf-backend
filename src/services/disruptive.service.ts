import { prisma } from "../config/db";
import { notificationService } from "./notification.service";

const CONVOCATION_THRESHOLD = 5;

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}
function startOfNextMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 1);
}

export const disruptiveService = {
  /**
   * Enregistre un signalement rapide "élève perturbateur" — compte immédiatement,
   * sans validation du surveillant. Au 5e signalement du mois calendaire en cours,
   * une convocation est automatiquement envoyée aux parents.
   */
  async report(schoolId: string, studentId: string, reportedByUserId: string) {
    await prisma.disruptiveReport.create({
      data: { schoolId, studentId, reportedByUserId },
    });

    const now = new Date();
    const count = await prisma.disruptiveReport.count({
      where: { schoolId, studentId, createdAt: { gte: startOfMonth(now), lt: startOfNextMonth(now) } },
    });

    if (count === CONVOCATION_THRESHOLD) {
      const student = await prisma.student.findUnique({ where: { id: studentId } });
      await notificationService.notifyParentsOfStudent(
        schoolId,
        studentId,
        "CONVOCATION",
        `Convocation — ${student?.firstName ?? "Votre enfant"}`,
        `Votre enfant a fait l'objet de ${CONVOCATION_THRESHOLD} signalements de comportement ce mois-ci. Nous vous prions de bien vouloir vous présenter à l'école pour un entretien avec la direction.`
      );
    }

    return { count, convocationSent: count === CONVOCATION_THRESHOLD };
  },

  /** Compteur du mois en cours pour un élève (affiché à côté du bouton "Signaler") */
  async currentMonthCount(schoolId: string, studentId: string) {
    const now = new Date();
    const count = await prisma.disruptiveReport.count({
      where: { schoolId, studentId, createdAt: { gte: startOfMonth(now), lt: startOfNextMonth(now) } },
    });
    return { count, threshold: CONVOCATION_THRESHOLD };
  },

  /** Compteurs du mois en cours pour tous les élèves d'une classe (vue professeur) */
  async currentMonthCountsForClass(schoolId: string, classId: string) {
    const now = new Date();
    const students = await prisma.student.findMany({ where: { schoolId, classId } });
    const reports = await prisma.disruptiveReport.groupBy({
      by: ["studentId"],
      where: {
        schoolId,
        studentId: { in: students.map((s) => s.id) },
        createdAt: { gte: startOfMonth(now), lt: startOfNextMonth(now) },
      },
      _count: true,
    });
    const countByStudent = new Map(reports.map((r) => [r.studentId, r._count]));
    return students.map((s) => ({
      studentId: s.id,
      firstName: s.firstName,
      lastName: s.lastName,
      count: countByStudent.get(s.id) ?? 0,
      threshold: CONVOCATION_THRESHOLD,
    }));
  },
};
