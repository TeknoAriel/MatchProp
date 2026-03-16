/**
 * Emails de administradores Kiteprop. Se reconocen como ADMIN en perfil y en requireRole
 * aunque el rol en DB sea otro (p. ej. si el usuario se creó por magic link antes del seed).
 * Contraseña única para bootstrap/login en prod cuando el seed no se ejecutó.
 */
export const KITEPROP_ADMIN_EMAILS: readonly string[] = [
  'ariel@kiteprop.com',
  'jonas@kiteprop.com',
  'soporte@kiteprop.com',
];

/** Contraseña de bootstrap para los admins Kiteprop (login y seed). */
export const KITEPROP_ADMIN_PASSWORD = 'KiteProp123';

export function isKitepropAdmin(email: string | null | undefined): boolean {
  return !!email && KITEPROP_ADMIN_EMAILS.includes(email.toLowerCase());
}
