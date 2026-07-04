/** Génère un PIN à 6 chiffres pour les comptes parent (ex: "384726") */
export function generatePin(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * Génère un mot de passe temporaire pour admin/surveillant respectant la politique
 * (8+ caractères, lettres + chiffres) — affiché une fois à la création du compte.
 */
export function generateStaffPassword(): string {
  const letters = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ";
  const digits = "23456789";
  let result = "";
  for (let i = 0; i < 6; i++) result += letters[Math.floor(Math.random() * letters.length)];
  for (let i = 0; i < 2; i++) result += digits[Math.floor(Math.random() * digits.length)];
  return result;
}
