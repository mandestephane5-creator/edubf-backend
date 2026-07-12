import { prisma } from "../config/db";
import { notificationService } from "./notification.service";

export const validationService = {
  /**
   * Liste toutes les classes ayant des notes et/ou incidents en attente de validation,
   * regroupés (même si plusieurs professeurs ont soumis pour la même classe).
   */
  async listPendingByClass(schoolId: string) {
    const [pendingGrades, pendingIncidents, allClasses] = await Promise.all([
      prisma.grade.findMany({
        where: { schoolId, status: "PENDING" },
        include: { subject: true, enteredBy: true, class: true },
      }),
      prisma.incident.findMany({
        where: { schoolId, status: "PENDING" },
        include: { subject: true, enteredBy: true, student: { include: { class: true } } },
      }),
      prisma.class.findMany({ where: { schoolId }, orderBy: { name: "asc" } }),
    ]);

    const byClass = new Map<
      string,
      { classId: string; className: string; gradesCount: number; incidentsCount: number; subjects: Set<string>; teachers: Set<string> }
    >();

    for (const c of allClasses) {
      byClass.set(c.id, { classId: c.id, className: c.name, gradesCount: 0, incidentsCount: 0, subjects: new Set(), teachers: new Set() });
    }

    for (const g of pendingGrades) {
      const entry = byClass.get(g.classId);
      if (!entry) continue;
      entry.gradesCount++;
      entry.subjects.add(g.subject.name);
      entry.teachers.add(`${g.enteredBy.firstName ?? ""} ${g.enteredBy.lastName ?? ""}`.trim() || g.enteredBy.email || "?");
    }

    for (const i of pendingIncidents) {
      const classId = i.student.classId;
      if (!classId) continue;
      const entry = byClass.get(classId);
      if (!entry) continue;
      entry.incidentsCount++;
      entry.teachers.add(`${i.enteredBy.firstName ?? ""} ${i.enteredBy.lastName ?? ""}`.trim() || i.enteredBy.email || "?");
    }

    return Array.from(byClass.values()).map((e) => ({
      classId: e.classId,
      className: e.className,
      gradesCount: e.gradesCount,
      incidentsCount: e.incidentsCount,
      subjects: Array.from(e.subjects),
      teachers: Array.from(e.teachers),
      hasPending: e.gradesCount > 0 || e.incidentsCount > 0,
    }));
  },

  /** Détail des notes/incidents en attente pour une classe précise, avant validation */
  async getPendingDetailForClass(schoolId: string, classId: string) {
    const [grades, incidents] = await Promise.all([
      prisma.grade.findMany({
        where: { schoolId, classId, status: "PENDING" },
        include: { student: true, subject: true, enteredBy: true },
        orderBy: { createdAt: "desc" },
      }),
      prisma.incident.findMany({
        where: { schoolId, status: "PENDING", student: { classId } },
        include: { student: true, subject: true, enteredBy: true },
        orderBy: { createdAt: "desc" },
      }),
    ]);
    return { grades, incidents };
  },

  /**
   * Valide TOUTES les notes et incidents en attente pour une classe entière, en un seul
   * geste (pas note par note) — puis déclenche les notifications aux parents concernés.
   */
  async validateClass(schoolId: string, classId: string) {
    const { grades, incidents } = await this.getPendingDetailForClass(schoolId, classId);
    if (grades.length === 0 && incidents.length === 0) return { validatedGrades: 0, validatedIncidents: 0 };

    const cls = await prisma.class.findUnique({ where: { id: classId } });

    await prisma.$transaction([
      prisma.grade.updateMany({ where: { schoolId, classId, status: "PENDING" }, data: { status: "VALIDATED" } }),
      prisma.incident.updateMany({
        where: { schoolId, status: "PENDING", student: { classId } },
        data: { status: "VALIDATED" },
      }),
    ]);

    // Notifie chaque élève concerné une seule fois, même s'il a plusieurs notes/incidents validés
    const studentIds = new Set<string>([...grades.map((g) => g.studentId), ...incidents.map((i) => i.studentId)]);
    for (const studentId of studentIds) {
      await notificationService.notifyParentsOfStudent(
        schoolId,
        studentId,
        "NOTE",
        "Nouvelles notes disponibles",
        "De nouvelles notes ou informations ont été validées par l'école."
      );
    }

    // Notifie aussi le(s) professeur(s) à l'origine de ces notes/incidents — seulement
    // ceux dont le compte est bien un TEACHER (pas l'admin/surveillant lui-même).
    const teacherUserIds = new Set<string>();
    for (const g of grades) if (g.enteredBy.role === "TEACHER") teacherUserIds.add(g.enteredByUserId);
    for (const i of incidents) if (i.enteredBy.role === "TEACHER") teacherUserIds.add(i.enteredByUserId);
    if (teacherUserIds.size > 0) {
      await notificationService.broadcastToUsers(
        schoolId,
        Array.from(teacherUserIds),
        "SYSTEME",
        "Soumission validée",
        `Vos notes/incidents pour ${cls?.name ?? "votre classe"} ont été validés et sont maintenant visibles aux parents.`
      );
    }

    return { validatedGrades: grades.length, validatedIncidents: incidents.length };
  },
};
