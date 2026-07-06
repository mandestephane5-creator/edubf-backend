import { prisma } from "../config/db";
import { notificationService } from "../services/notification.service";

const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000; // vérifie toutes les 6 heures
const REMINDER_DAYS_BEFORE = 2;

/**
 * Cherche les jours de composition qui tombent dans exactement N jours et n'ont pas
 * encore reçu leur rappel, puis notifie tous les parents de l'école concernée.
 * Le champ `reminderSent` empêche d'envoyer le même rappel plusieurs fois.
 */
async function checkUpcomingCompositions() {
  try {
    const now = new Date();
    const targetDayStart = new Date(now);
    targetDayStart.setDate(targetDayStart.getDate() + REMINDER_DAYS_BEFORE);
    targetDayStart.setHours(0, 0, 0, 0);
    const targetDayEnd = new Date(targetDayStart);
    targetDayEnd.setDate(targetDayEnd.getDate() + 1);

    const upcoming = await prisma.compositionDate.findMany({
      where: { date: { gte: targetDayStart, lt: targetDayEnd }, reminderSent: false },
    });

    for (const composition of upcoming) {
      const parentUsers = await prisma.user.findMany({
        where: { schoolId: composition.schoolId, role: "PARENT" },
      });
      if (parentUsers.length > 0) {
        await notificationService.broadcastToUsers(
          composition.schoolId,
          parentUsers.map((u) => u.id),
          "EVALUATION",
          "Composition dans 2 jours",
          `${composition.label || "Une composition"} est prévue le ${composition.date.toLocaleDateString("fr-FR")}.`
        );
      }
      await prisma.compositionDate.update({ where: { id: composition.id }, data: { reminderSent: true } });
    }
  } catch (err) {
    console.error("[EduBF] Erreur lors de la vérification des rappels de composition:", err);
  }
}

/** À appeler une fois au démarrage du serveur — lance la vérification immédiatement puis toutes les 6h */
export function startCompositionReminderScheduler() {
  checkUpcomingCompositions();
  setInterval(checkUpcomingCompositions, CHECK_INTERVAL_MS);
}
