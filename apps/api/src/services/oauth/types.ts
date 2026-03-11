export type OAuthProvider = 'google' | 'apple' | 'facebook';

export interface OAuthProfile {
  providerUserId: string;
  email: string | null;
  emailVerified: boolean;
  name?: string | null;
  avatarUrl?: string | null;
}

export interface OAuthProviderAdapter {
  getAuthorizationUrl(params: {
    state: string;
    redirectUri: string;
    codeVerifier?: string;
  }): string;
  exchangeCodeForProfile(
    code: string,
    redirectUri: string,
    codeVerifier?: string
  ): Promise<OAuthProfile>;
}
