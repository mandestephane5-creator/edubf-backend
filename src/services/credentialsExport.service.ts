import PDFDocument from "pdfkit";
import { prisma } from "../config/db";
import { ApiError } from "../utils/ApiError";
import { hashPassword } from "../utils/password";
import { generatePin } from "../utils/credentials";

export const credentialsExportService = {
  /**
   * Régénère un nouveau mot de passe pour chaque compte parent lié à un élève de la
   * classe, puis renvoie la liste matricule + mot de passe pour impression.
   *
   * Note de sécurité : les mots de passe ne sont jamais stockés en clair dans la base
   * (seul le hash l'est) — il est donc impossible de "retrouver" un ancien mot de passe.
   * Cette action en régénère systématiquement de nouveaux, qui remplacent les précédents
   * (les anciens identifiants cessent de fonctionner après export).
   */
  async regenerateAndListForClass(schoolId: string, classId: string) {
    const cls = await prisma.class.findFirst({ where: { id: classId, schoolId } });
    if (!cls) throw ApiError.notFound("Classe introuvable");

    const students = await prisma.student.findMany({
      where: { schoolId, classId },
      include: { parents: { include: { parent: { include: { user: true } } } } },
      orderBy: { lastName: "asc" },
    });

    const rows: { matricule: string; firstName: string; lastName: string; password: string }[] = [];

    for (const student of students) {
      const primaryLink = student.parents[0];
      if (!primaryLink) continue; // élève sans compte parent lié — ignoré
      const newPin = generatePin();
      const hashed = await hashPassword(newPin);
      await prisma.user.update({
        where: { id: primaryLink.parent.userId },
        data: { password: hashed, mustChangePassword: true },
      });
      rows.push({ matricule: student.matricule, firstName: student.firstName, lastName: student.lastName, password: newPin });
    }

    return { className: cls.name, rows };
  },

  /** Génère le PDF à partir de la liste (className + rows) — appelé juste après regenerateAndListForClass */
  generatePdf(className: string, rows: { matricule: string; firstName: string; lastName: string; password: string }[]): PDFKit.PDFDocument {
    const doc = new PDFDocument({ margin: 40, size: "A4" });

    doc.fontSize(18).text(`Identifiants de connexion — ${className}`, { align: "center" });
    doc.moveDown(0.3);
    doc.fontSize(10).fillColor("#666").text(`Généré le ${new Date().toLocaleDateString("fr-FR")}`, { align: "center" });
    doc.moveDown(1.5);

    const colX = [40, 220, 340, 440];
    const headerY = doc.y;
    doc.fontSize(11).fillColor("#000").font("Helvetica-Bold");
    doc.text("Élève", colX[0], headerY);
    doc.text("Numéro de compte", colX[1], headerY);
    doc.text("Mot de passe", colX[2], headerY);
    doc.moveDown(0.5);
    doc.moveTo(40, doc.y).lineTo(555, doc.y).strokeColor("#ccc").stroke();
    doc.moveDown(0.3);

    doc.font("Helvetica").fontSize(10);
    for (const row of rows) {
      const y = doc.y;
      if (y > 750) doc.addPage();
      doc.text(`${row.lastName} ${row.firstName}`, colX[0], doc.y, { width: 170 });
      doc.text(row.matricule, colX[1], y, { width: 110 });
      doc.text(row.password, colX[2], y, { width: 100 });
      doc.moveDown(0.6);
    }

    doc.moveDown(1);
    doc
      .fontSize(9)
      .fillColor("#999")
      .text(
        "Ces identifiants remplacent les précédents. Communiquez-les aux parents concernés ; un changement de mot de passe sera demandé à la première connexion.",
        40,
        doc.y,
        { width: 515 }
      );

    return doc;
  },
};
