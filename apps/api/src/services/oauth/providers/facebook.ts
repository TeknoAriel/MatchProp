import type { OAuthProviderAdapter, OAuthProfile } from '../types.js';

const FB_AUTH_URL = 'https://www.facebook.com/v18.0/dialog/oauth';
const FB_TOKEN_URL = 'https://graph.facebook.com/v18.0/oauth/access_token';
const FB_GRAPH_URL = 'https://graph.facebook.com/v18.0/me';

export function createFacebookAdapter(): OAuthProviderAdapter | null {
  const clientId = process.env.FACEBOOK_CLIENT_ID;
  const clientSecret = process.env.FACEBOOK_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;

  return {
    getAuthorizationUrl({ state, redirectUri }) {
      const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: 'code',
        scope: 'email,public_profile',
        state,
      });
      return `${FB_AUTH_URL}?${params}`;
    },

    async exchangeCodeForProfile(code: string, redirectUri: string) {
      const tokenParams = new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: redirectUri,
      });
      const tokenRes = await fetch(`${FB_TOKEN_URL}?${tokenParams}`);
      if (!tokenRes.ok) throw new Error('Facebook token exchange failed');
      const tokens = (await tokenRes.json()) as { access_token?: string };
      const accessToken = tokens.access_token;
      if (!accessToken) throw new Error('No access_token from Facebook');

      const userParams = new URLSearchParams({
        access_token: accessToken,
        fields: 'id,email,name,picture.type(large)',
      });
      const userRes = await fetch(`${FB_GRAPH_URL}?${userParams}`);
      if (!userRes.ok) throw new Error('Facebook graph failed');
      const user = (await userRes.json()) as {
        id: string;
        email?: string;
        name?: string;
        picture?: { data?: { url?: string } };
      };

      const avatarUrl = user.picture?.data?.url ?? null;
      return {
        providerUserId: user.id,
        email: user.email ?? null,
        emailVerified: !!user.email,
        name: user.name ?? null,
        avatarUrl,
      } satisfies OAuthProfile;
    },
  };
}
