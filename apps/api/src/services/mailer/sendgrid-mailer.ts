import type { AlertEmailPayload, Mailer } from './types.js';

export function createSendGridMailerFromCredentials(apiKey: string, from: string): Mailer {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const sgMail = require('@sendgrid/mail');
  sgMail.setApiKey(apiKey);
  return {
    async sendMagicLink(email: string, link: string) {
      await sgMail.send({
        to: email,
        from,
        subject: 'Iniciar sesión en MatchProp',
        text: `Hacé clic en este link para iniciar sesión: ${link}`,
        html: `<p>Hacé clic en este link para iniciar sesión:</p><p><a href="${link}">${link}</a></p><p>El link vence en 15 minutos.</p>`,
      });
    },
    async sendAlertNotification(payload: AlertEmailPayload) {
      await sgMail.send({
        to: payload.to,
        from,
        subject: payload.subject,
        text: payload.text,
        html: payload.html,
      });
    },
  };
}

/** Devuelve mailer SendGrid desde env (SENDGRID_API_KEY, SENDGRID_FROM). */
export function getSendGridMailerFromEnv(): Mailer | null {
  if (!process.env.SENDGRID_API_KEY?.trim()) return null;
  try {
    return createSendGridMailerFromCredentials(
      process.env.SENDGRID_API_KEY,
      process.env.SENDGRID_FROM || 'noreply@matchprop.com'
    );
  } catch {
    return null;
  }
}
