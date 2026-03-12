import 'dotenv/config';

/** Feature flags centralizados (Sprint 9). En prod: demoMode=false, demo sources OFF. */
export const featureFlags = {
  /** 1 = dev/test. En prod forzar 0. */
  demoMode: process.env.DEMO_MODE === '1',
  /** KITEPROP_EXTERNALSITE_MODE=fixture habilitado solo en demoMode. */
  kitepropExternalsite:
    process.env.KITEPROP_EXTERNALSITE_MODE === 'fixture' && process.env.DEMO_MODE === '1',
  /** API_PARTNER_1 habilitado solo en demoMode. */
  apiPartner1: process.env.DEMO_MODE === '1',
  /** Stripe Premium B2C. Requiere STRIPE_SECRET_KEY. */
  stripePremium: !!(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_SECRET_KEY.length > 0),
};

function parseCorsOrigins(val: string): string[] {
  return val
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

export const config = {
  /** 1 = dev/test (demo sources, demo data). En prod forzar 0. */
  demoMode: process.env.DEMO_MODE === '1',
  port: Number(process.env.PORT) || 3001,
  jwtSecret: process.env.JWT_SECRET || process.env.AUTH_JWT_SECRET || 'dev-secret',
  refreshSecret: process.env.AUTH_REFRESH_SECRET || process.env.JWT_SECRET || 'dev-refresh-secret',
  corsOrigins: parseCorsOrigins(
    process.env.CORS_ORIGINS || 'http://localhost:3000,http://localhost:19006,exp://localhost:19000'
  ),
  cookieSecure: process.env.COOKIE_SECURE === 'true',
  appUrl: process.env.APP_URL || 'http://localhost:3000',
  apiPublicUrl: process.env.API_PUBLIC_URL || process.env.APP_URL || 'http://localhost:3001',
  authRateLimitMax: Number(process.env.AUTH_RATE_LIMIT_MAX) || 10,
  authRateLimitWindowMs: Number(process.env.AUTH_RATE_LIMIT_WINDOW_MS) || 60_000,
  oauthSuccessRedirect:
    process.env.OAUTH_SUCCESS_REDIRECT_URL ||
    `${process.env.APP_URL || 'http://localhost:3000'}/dashboard`,
  oauthFailureRedirect:
    process.env.OAUTH_FAILURE_REDIRECT_URL ||
    `${process.env.APP_URL || 'http://localhost:3000'}/login?error=oauth`,
  webauthnRpId: process.env.WEBAUTHN_RP_ID || 'localhost',
  webauthnRpName: process.env.WEBAUTHN_RP_NAME || 'MatchProp',
  webauthnOrigin: process.env.WEBAUTHN_ORIGIN || process.env.APP_URL || 'http://localhost:3000',
  oauthCallbackBase:
    process.env.OAUTH_CALLBACK_BASE_URL ||
    (process.env.APP_URL ? `${process.env.APP_URL.replace(/\/$/, '')}/api` : undefined) ||
    process.env.API_PUBLIC_URL ||
    'http://localhost:3001',
  /** Sprint 10: push listing.matches_found al CRM. Opcional. */
  crmWebhookUrl: process.env.CRM_WEBHOOK_URL || '',
  crmWebhookSecret: process.env.CRM_WEBHOOK_SECRET || '',
  /** Sprint 9: débito por activación de lead (centavos). Default 100 = 1 ARS. */
  leadDebitCents: Number(process.env.LEAD_DEBIT_CENTS) || 100,
};
