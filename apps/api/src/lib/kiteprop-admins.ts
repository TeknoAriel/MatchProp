/**
 * Emails de administradores Kiteprop. Se reconocen como ADMIN en perfil y en requireRole
 * aunque el rol en DB sea otro (p. ej. si el usuario se creó por magic link antes del seed).
 */
export const KITEPROP_ADMIN_EMAILS: readonly string[] = [
  'ariel@kiteprop.com',
  'jonas@kiteprop.com',
  'soporte@kiteprop.com',
];

export function isKitepropAdmin(email: string | null | undefined): boolean {
  return !!email && KITEPROP_ADMIN_EMAILS.includes(email.toLowerCase());
}
