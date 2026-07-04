import { prisma } from "../config/db";
import { gradeService } from "./grade.service";

const ABSENCE_THRESHOLD = 5;
const AVERAGE_THRESHOLD = 8;

function currentMonthKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function monthRange(month: string) {
  const start = new Date(`${month}-01T00:00:00.000Z`);
  const end = new Date(start);
  end.setMonth(end.getMonth() + 1);
  return { gte: start, lt: end };
}

export const riskService = {
  /**
   * Liste les élèves "à risque" : 5 absences ou plus ce mois-ci, OU moyenne générale
   * du trimestre en cours inférieure à 8/20.
   */
  async listAtRiskStudents(schoolId: string, term: string, academicYear: string) {
    const students = await prisma.student.findMany({ where: { schoolId }, include: { class: true } });
    const month = currentMonthKey();

    const results = await Promise.all(
      students.map(async (student) => {
        const absencesCount = await prisma.incident.count({
          where: { schoolId, studentId: student.id, type: "ABSENCE", date: monthRange(month) },
        });
        const { average } = await gradeService.computeStudentAverage(schoolId, student.id, term, academicYear);

        const reasons: string[] = [];
        if (absencesCount >= ABSENCE_THRESHOLD) reasons.push(`${absencesCount} absences ce mois-ci`);
        if (average > 0 && average < AVERAGE_THRESHOLD) reasons.push(`Moyenne de ${average}/20`);

        return reasons.length > 0
          ? {
              studentId: student.id,
              firstName: student.firstName,
              lastName: student.lastName,
              className: student.class?.name ?? "—",
              absencesCount,
              average,
              reasons,
            }
          : null;
      })
    );

    return results.filter(Boolean);
  },
};
