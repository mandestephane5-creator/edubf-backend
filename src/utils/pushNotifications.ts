import { prisma } from "../config/db";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

/**
 * Envoie une notification push à un ou plusieurs utilisateurs, via tous leurs jetons
 * Expo enregistrés (un utilisateur peut avoir plusieurs appareils). Échoue silencieusement
 * en cas de problème réseau — la notification "interne" (table Notification) reste
 * toujours créée séparément, le push n'est qu'un bonus best-effort.
 *
 * `data` (ex: { studentId }) est inclus dans la notification pour que l'app puisse
 * naviguer directement vers le bon écran quand l'utilisateur tape dessus, même si
 * l'app était fermée.
 */
export async function sendPushToUsers(userIds: string[], title: string, body: string, data?: Record<string, string>) {
  if (userIds.length === 0) return;

  try {
    const tokens = await prisma.pushToken.findMany({ where: { userId: { in: userIds } } });
    console.log(`[Vorelix Push] ${tokens.length} jeton(s) trouvé(s) pour ${userIds.length} utilisateur(s) ciblé(s).`);
    if (tokens.length === 0) {
      console.warn("[Vorelix Push] Aucun jeton enregistré pour ces utilisateurs — le push ne sera pas envoyé.");
      return;
    }

    const messages = tokens.map((t) => ({
      to: t.token,
      sound: "default",
      title,
      body,
      ...(data && { data }),
    }));

    const res = await fetch(EXPO_PUSH_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(messages),
    });
    const result = await res.json();
    console.log("[Vorelix Push] Réponse de l'API Expo:", JSON.stringify(result));
  } catch (err) {
    console.error("[Vorelix] Échec envoi notification push (non bloquant):", err);
  }
}
