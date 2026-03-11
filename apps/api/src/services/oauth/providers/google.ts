import { createHash } from 'crypto';
import type { OAuthProviderAdapter, OAuthProfile } from '../types.js';

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_USERINFO_URL = 'https://openidconnect.googleapis.com/v1/userinfo';

export function createGoogleAdapter(): OAuthProviderAdapter | null {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;

  return {
    getAuthorizationUrl({ state, redirectUri, codeVerifier }) {
      const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: 'code',
        scope: 'openid email profile',
        state,
      });
      if (codeVerifier) {
        const challenge = createHash('sha256').update(codeVerifier).digest('base64url');
        params.set('code_challenge', challenge);
        params.set('code_challenge_method', 'S256');
      }
      return `${GOOGLE_AUTH_URL}?${params}`;
    },

    async exchangeCodeForProfile(code: string, redirectUri: string, codeVerifier?: string) {
      const params = new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        code,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      });
      if (codeVerifier) params.set('code_verifier', codeVerifier);

      const tokenRes = await fetch(GOOGLE_TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params,
      });
      if (!tokenRes.ok) {
        const err = await tokenRes.text();
        throw new Error(`Google token exchange failed: ${err}`);
      }
      const tokens = (await tokenRes.json()) as { access_token?: string };
      const accessToken = tokens.access_token;
      if (!accessToken) throw new Error('No access_token from Google');

      const userRes = await fetch(GOOGLE_USERINFO_URL, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!userRes.ok) throw new Error('Google userinfo failed');
      const user = (await userRes.json()) as {
        sub: string;
        email?: string;
        email_verified?: boolean;
        name?: string;
        picture?: string;
      };

      return {
        providerUserId: user.sub,
        email: user.email ?? null,
        emailVerified: user.email_verified ?? false,
        name: user.name ?? null,
        avatarUrl: user.picture ?? null,
      } satisfies OAuthProfile;
    },
  };
}
