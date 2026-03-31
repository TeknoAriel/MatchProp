export type AlertEmailPayload = {
  to: string;
  subject: string;
  text: string;
  html: string;
};

export interface Mailer {
  sendMagicLink(email: string, link: string): Promise<void>;
  /** Avisos de alertas (listings). Usa el mismo transport que magic link. */
  sendAlertNotification(payload: AlertEmailPayload): Promise<void>;
}
