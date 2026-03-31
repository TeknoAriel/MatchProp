import { randomBytes } from 'crypto';
import { prisma } from '../lib/prisma.js';
import type { IdentityProvider } from '@prisma/client';
import type { OAuthProfile } from './oauth/types.js';

const OAUTH_ATTEMPT_EXPIRY_MIN = 10;

export function generateState(): string {
  return randomBytes(24).toString('base64url');
}

export function generateCodeVerifier(): string {
  return randomBytes(32).toString('base64url');
}

export function getOAuthAttemptExpiry(): Date {
  const d = new Date();
  d.setMinutes(d.getMinutes() + OAUTH_ATTEMPT_EXPIRY_MIN);
  return d;
}

export async function createOAuthAttempt(params: {
  state: string;
  provider: string;
  redirectUri?: string;
  codeVerifier?: string;
  ip?: string;
  userAgent?: string;
}) {
  await prisma.oAuthAttempt.create({
    data: {
      state: params.state,
      provider: params.provider,
      redirectUri: params.redirectUri,
      codeVerifier: params.codeVerifier,
      ip: params.ip,
      userAgent: params.userAgent,
    },
  });
}

export async function consumeOAuthAttempt(state: string) {
  const now = new Date();
  const attempt = await prisma.oAuthAttempt.findUnique({
    where: { state },
  });
  if (!attempt || attempt.usedAt) return null;
  const createdAt = attempt.createdAt;
  const expiresAt = new Date(createdAt.getTime() + OAUTH_ATTEMPT_EXPIRY_MIN * 60 * 1000);
  if (expiresAt < now) return null;

  await prisma.oAuthAttempt.update({
    where: { id: attempt.id },
    data: { usedAt: now },
  });
  return attempt;
}

export async function upsertUserAndIdentityFromOAuth(
  provider: 'google' | 'apple' | 'facebook',
  profile: OAuthProfile
): Promise<{ userId: string; email: string; role: string; isNewUser: boolean }> {
  const providerEnum = provider as IdentityProvider;

  const existingIdentity = await prisma.userIdentity.findUnique({
    where: {
      provider_providerUserId: {
        provider: providerEnum,
        providerUserId: profile.providerUserId,
      },
    },
    include: { user: true },
  });

  if (existingIdentity) {
    return {
      userId: existingIdentity.userId,
      email: existingIdentity.user.email,
      role: existingIdentity.user.role,
      isNewUser: false,
    };
  }

  if (profile.email && profile.emailVerified) {
    const existingUser = await prisma.user.findUnique({
      where: { email: profile.email },
    });
    if (existingUser) {
      await prisma.userIdentity.create({
        data: {
          userId: existingUser.id,
          provider: providerEnum,
          providerUserId: profile.providerUserId,
          email: profile.email,
          emailVerified: true,
          profileJson:
            profile.name || profile.avatarUrl
              ? { name: profile.name, avatarUrl: profile.avatarUrl }
              : undefined,
        },
      });
      return {
        userId: existingUser.id,
        email: existingUser.email,
        role: existingUser.role,
        isNewUser: false,
      };
    }
  }

  const email =
    profile.email && profile.emailVerified
      ? profile.email
      : `${profile.providerUserId}@${provider}.oauth.local`;
  const user = await prisma.user.create({
    data: {
      email,
      role: 'BUYER',
    },
  });
  await prisma.userIdentity.create({
    data: {
      userId: user.id,
      provider: providerEnum,
      providerUserId: profile.providerUserId,
      email: profile.email || email,
      emailVerified: profile.emailVerified ?? false,
      profileJson:
        profile.name || profile.avatarUrl
          ? { name: profile.name, avatarUrl: profile.avatarUrl }
          : undefined,
    },
  });
  return {
    userId: user.id,
    email: user.email,
    role: user.role,
    isNewUser: true,
  };
}
