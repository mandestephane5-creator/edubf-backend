import { prisma } from "../config/db";

function toCsv(rows: string[][]): string {
  return rows.map((row) => row.map(escapeCsvCell).join(",")).join("\n");
}

function escapeCsvCell(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export const exportService = {
  /** Export de la liste d'une classe (nom, matricule, contact parent) */
  async exportClassList(schoolId: string, classId: string): Promise<string> {
    const students = await prisma.student.findMany({
      where: { schoolId, classId },
      include: { parents: { include: { parent: { include: { user: true } } } } },
      orderBy: { lastName: "asc" },
    });

    const rows: string[][] = [["Matricule", "Nom", "Prénom", "Parent", "Téléphone"]];
    for (const s of students) {
      const primaryParent = s.parents[0]?.parent;
      rows.push([
        s.matricule,
        s.lastName,
        s.firstName,
        primaryParent ? `${primaryParent.firstName} ${primaryParent.lastName}` : "—",
        primaryParent?.user.phone ?? "—",
      ]);
    }
    return toCsv(rows);
  },

  /** Export des notes d'une classe pour un trimestre */
  async exportClassGrades(schoolId: string, classId: string, term: string, academicYear: string): Promise<string> {
    const grades = await prisma.grade.findMany({
      where: { schoolId, classId, term: term as any, academicYear },
      include: { student: true, subject: true },
      orderBy: [{ student: { lastName: "asc" } }, { subject: { name: "asc" } }],
    });

    const rows: string[][] = [["Matricule", "Élève", "Matière", "Note", "Sur", "Coefficient", "Libellé"]];
    for (const g of grades) {
      rows.push([
        g.student.matricule,
        `${g.student.firstName} ${g.student.lastName}`,
        g.subject.name,
        String(g.value),
        String(g.maxValue),
        String(g.coefficient),
        g.label ?? "",
      ]);
    }
    return toCsv(rows);
  },
};
