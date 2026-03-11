import type { OAuthProvider, OAuthProviderAdapter } from './types.js';
import { createGoogleAdapter } from './providers/google.js';
import { createAppleAdapter } from './providers/apple.js';
import { createFacebookAdapter } from './providers/facebook.js';

const adapters: Record<OAuthProvider, () => OAuthProviderAdapter | null> = {
  google: createGoogleAdapter,
  apple: createAppleAdapter,
  facebook: createFacebookAdapter,
};

export function getOAuthAdapter(provider: OAuthProvider): OAuthProviderAdapter | null {
  return adapters[provider]?.() ?? null;
}

export function isOAuthConfigured(provider: OAuthProvider): boolean {
  return getOAuthAdapter(provider) !== null;
}

export type { OAuthProvider, OAuthProfile, OAuthProviderAdapter } from './types.js';
