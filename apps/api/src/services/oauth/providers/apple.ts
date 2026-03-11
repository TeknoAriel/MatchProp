import { createSign } from 'crypto';
import type { OAuthProviderAdapter, OAuthProfile } from '../types.js';

const APPLE_AUTH_URL = 'https://appleid.apple.com/auth/authorize';
const APPLE_TOKEN_URL = 'https://appleid.apple.com/auth/token';

function generateAppleClientSecret(): string {
  const teamId = process.env.APPLE_TEAM_ID;
  const keyId = process.env.APPLE_KEY_ID;
  const clientId = process.env.APPLE_CLIENT_ID;
  let privateKey = process.env.APPLE_PRIVATE_KEY;

  if (!teamId || !keyId || !clientId || !privateKey) {
    throw new Error('Apple OAuth not configured');
  }
  if (privateKey.includes('\\n')) {
    privateKey = privateKey.replace(/\\n/g, '\n');
  }
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: teamId,
    iat: now,
    exp: now + 3600,
    aud: 'https://appleid.apple.com',
    sub: clientId,
  };
  const header = { alg: 'ES256', kid: keyId };
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const headerB64 = Buffer.from(JSON.stringify(header)).toString('base64url');
  const sign = createSign('SHA256');
  sign.update(`${headerB64}.${payloadB64}`);
  const sig = sign.sign(privateKey, 'base64url');
  return `${headerB64}.${payloadB64}.${sig}`;
}

export function createAppleAdapter(): OAuthProviderAdapter | null {
  const clientId = process.env.APPLE_CLIENT_ID;
  if (
    !clientId ||
    !process.env.APPLE_TEAM_ID ||
    !process.env.APPLE_KEY_ID ||
    !process.env.APPLE_PRIVATE_KEY
  ) {
    return null;
  }

  return {
    getAuthorizationUrl({ state, redirectUri }) {
      const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: 'code id_token',
        response_mode: 'form_post',
        scope: 'name email',
        state,
      });
      return `${APPLE_AUTH_URL}?${params}`;
    },

    async exchangeCodeForProfile(code: string, redirectUri: string) {
      const clientSecret = generateAppleClientSecret();
      const params = new URLSearchParams({
        client_id: process.env.APPLE_CLIENT_ID!,
        client_secret: clientSecret,
        code,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      });

      const tokenRes = await fetch(APPLE_TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params,
      });
      if (!tokenRes.ok) {
        const err = await tokenRes.text();
        throw new Error(`Apple token exchange failed: ${err}`);
      }
      const tokens = (await tokenRes.json()) as { id_token?: string };
      const idToken = tokens.id_token;
      if (!idToken) throw new Error('No id_token from Apple');

      const parts = idToken.split('.');
      if (parts.length !== 3) throw new Error('Invalid Apple id_token');
      const payload = JSON.parse(Buffer.from(parts[1]!, 'base64url').toString()) as {
        sub: string;
        email?: string;
        email_verified?: boolean | string;
      };

      return {
        providerUserId: payload.sub,
        email: payload.email ?? null,
        emailVerified: payload.email_verified === true || payload.email_verified === 'true',
        name: null,
        avatarUrl: null,
      } satisfies OAuthProfile;
    },
  };
}
