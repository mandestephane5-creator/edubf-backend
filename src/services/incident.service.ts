import { prisma } from "../config/db";
import { ApiError } from "../utils/ApiError";
import { CreateIncidentInput } from "../validators/academic.validator";

function monthRange(month: string) {
  const start = new Date(`${month}-01T00:00:00.000Z`);
  const end = new Date(start);
  end.setMonth(end.getMonth() + 1);
  return { gte: start, lt: end };
}

export const incidentService = {
  async list(
    schoolId: string,
    filters: { classId?: string; studentId?: string; month?: string },
    options?: { onlyValidated?: boolean }
  ) {
    return prisma.incident.findMany({
      where: {
        schoolId,
        studentId: filters.studentId,
        ...(filters.classId && { student: { classId: filters.classId } }),
        ...(filters.month && { date: monthRange(filters.month) }),
        ...(options?.onlyValidated && { status: "VALIDATED" }),
      },
      include: { student: true, subject: true, enteredBy: { select: { email: true } } },
      orderBy: { date: "desc" },
    });
  },

  async create(schoolId: string, enteredByUserId: string, input: CreateIncidentInput, enteredByRole?: string) {
    const student = await prisma.student.findFirst({ where: { id: input.studentId, schoolId } });
    if (!student) throw ApiError.badRequest("Élève invalide pour cette école");

    if (input.type === "EXPULSION" && input.subjectId) {
      const subject = await prisma.subject.findFirst({ where: { id: input.subjectId, schoolId } });
      if (!subject) throw ApiError.badRequest("Matière invalide pour cette école");
    }

    const status = enteredByRole === "TEACHER" ? "PENDING" : "VALIDATED";
    return prisma.incident.create({
      data: { schoolId, enteredByUserId, status, ...input },
      include: { subject: true },
    });
  },

  async update(schoolId: string, id: string, input: Partial<CreateIncidentInput>) {
    const incident = await prisma.incident.findFirst({ where: { id, schoolId } });
    if (!incident) throw ApiError.notFound("Incident introuvable");
    return prisma.incident.update({ where: { id }, data: input });
  },

  async remove(schoolId: string, id: string) {
    const incident = await prisma.incident.findFirst({ where: { id, schoolId } });
    if (!incident) throw ApiError.notFound("Incident introuvable");
    return prisma.incident.delete({ where: { id } });
  },

  /** Compte les absences du mois en cours pour un élève (utilisé pour le signal "à risque") */
  async countAbsencesThisMonth(schoolId: string, studentId: string) {
    const now = new Date();
    const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    return prisma.incident.count({
      where: { schoolId, studentId, type: "ABSENCE", date: monthRange(month) },
    });
  },

  /**
   * Liste tous les incidents d'une classe sur une plage de dates (typiquement un
   * trimestre), pour l'export CSV destiné aux surveillants (retraits de points de fin
   * de trimestre). Aucune notion de "trimestre" n'existe en base — on filtre simplement
   * par dates, à choisir par le surveillant.
   */
  async listForExport(schoolId: string, classId: string, startDate: Date, endDate: Date) {
    return prisma.incident.findMany({
      where: { schoolId, student: { classId }, date: { gte: startDate, lte: endDate } },
      include: { student: true, subject: true },
      orderBy: [{ student: { lastName: "asc" } }, { date: "asc" }],
    });
  },

  /** Construit le contenu CSV (texte) à partir de la liste d'incidents ci-dessus */
  buildCsv(incidents: Awaited<ReturnType<typeof incidentService.listForExport>>) {
    const escape = (value: string) => `"${(value ?? "").replace(/"/g, '""')}"`;
    const header = ["Nom", "Prénom", "Type", "Date", "Heure", "Matière", "Motif"];
    const rows = incidents.map((i) => [
      i.student.lastName,
      i.student.firstName,
      i.type,
      new Date(i.date).toLocaleDateString("fr-FR"),
      i.time ?? "",
      i.subject?.name ?? "",
      i.motif ?? "",
    ]);
    return [header, ...rows].map((row) => row.map(escape).join(",")).join("\n");
  },
};
