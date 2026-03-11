export interface Mailer {
  sendMagicLink(email: string, link: string): Promise<void>;
}
