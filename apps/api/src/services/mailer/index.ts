import type { Mailer } from './types.js';
import { consoleMailer } from './console-mailer.js';
import {
  getSendGridMailerFromEnv,
  createSendGridMailerFromCredentials,
} from './sendgrid-mailer.js';
import { prisma } from '../../lib/prisma.js';
import { decrypt } from '../../lib/crypto.js';

export type { Mailer } from './types.js';
export { consoleMailer, getLastMagicLinkForEmail, clearMailerStore } from './console-mailer.js';

let _mailerSync: Mailer | null = null;

/** Mailer síncrono: usa env o console. Para tests. */
export function getMailer(): Mailer {
  if (_mailerSync) return _mailerSync;
  _mailerSync = getSendGridMailerFromEnv();
  if (_mailerSync) return _mailerSync;
  return consoleMailer;
}

/** True si hay API key SendGrid en DB (habilitada) o en env — apto para mail transaccional. */
export async function isSendGridAvailableForSend(): Promise<boolean> {
  try {
    const row = await prisma.sendGridConfig.findUnique({
      where: { id: 'default' },
    });
    if (row?.isEnabled && row.apiKeyEncrypted) return true;
  } catch {
    /* ignore */
  }
  return Boolean(process.env.SENDGRID_API_KEY?.trim());
}

/** Mailer para producción: prioridad 1) config en DB, 2) env, 3) console. */
export async function getMailerForSend(): Promise<Mailer> {
  try {
    const row = await prisma.sendGridConfig.findUnique({
      where: { id: 'default' },
    });
    if (row?.isEnabled && row.apiKeyEncrypted) {
      const apiKey = decrypt(row.apiKeyEncrypted);
      const from = row.fromEmail || 'noreply@matchprop.com';
      return createSendGridMailerFromCredentials(apiKey, from);
    }
  } catch {
    /* fallback */
  }
  const fromEnv = getSendGridMailerFromEnv();
  if (fromEnv) return fromEnv;
  return consoleMailer;
}
