import { Resend } from "resend";
import { env } from "../config/env";

const resend = env.resend.apiKey ? new Resend(env.resend.apiKey) : null;

/**
 * Envoie l'email de réinitialisation de mot de passe (admin/surveillant uniquement).
 * Si RESEND_API_KEY n'est pas configurée (ex: en développement local sans compte Resend),
 * le lien est simplement affiché dans les logs serveur plutôt que d'échouer bruyamment.
 */
export async function sendPasswordResetEmail(to: string, resetLink: string) {
  if (!resend) {
    console.log(`[Orivex] (Resend non configuré) Lien de réinitialisation pour ${to} : ${resetLink}`);
    return;
  }

  await resend.emails.send({
    from: env.resend.emailFrom,
    to,
    subject: "Réinitialisation de votre mot de passe Orivex",
    html: `
      <p>Bonjour,</p>
      <p>Une demande de réinitialisation de mot de passe a été effectuée pour votre compte Orivex.</p>
      <p><a href="${resetLink}">Cliquez ici pour choisir un nouveau mot de passe</a></p>
      <p>Ce lien expire dans 1 heure. Si vous n'êtes pas à l'origine de cette demande, ignorez cet email.</p>
    `,
  });
}
