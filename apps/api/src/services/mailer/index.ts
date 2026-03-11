import type { Mailer } from './types.js';
import { consoleMailer } from './console-mailer.js';

export type { Mailer } from './types.js';
export { consoleMailer, getLastMagicLinkForEmail, clearMailerStore } from './console-mailer.js';

export function getMailer(): Mailer {
  return consoleMailer;
}
