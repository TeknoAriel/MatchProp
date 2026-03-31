import type { AlertEmailPayload, Mailer } from './types.js';

const store: { email: string; link: string }[] = [];

/** Mailer que imprime en consola (dev/test). Para tests, usar getLastMagicLinkForEmail. */
export const consoleMailer: Mailer = {
  async sendMagicLink(email: string, link: string) {
    console.log(`[Mailer] Magic link for ${email}: ${link}`);
    store.push({ email, link });
  },
  async sendAlertNotification(payload: AlertEmailPayload) {
    console.log(`[Mailer] Alert email -> ${payload.to}: ${payload.subject}`);
  },
};

/** Para tests: obtener el último link enviado a un email */
export function getLastMagicLinkForEmail(email: string): string | undefined {
  const found = [...store].reverse().find((s) => s.email === email);
  return found?.link;
}

/** Para tests: limpiar el store */
export function clearMailerStore() {
  store.length = 0;
}
