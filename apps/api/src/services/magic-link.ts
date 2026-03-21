import { randomBytes, createHash } from 'crypto';
import { prisma } from '../lib/prisma.js';
import type { IdentityProvider } from '@prisma/client';

const TOKEN_BYTES = 32;
const TOKEN_EXPIRY_MIN = 15;

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function hashMagicToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function generateMagicToken(): string {
  return randomBytes(TOKEN_BYTES).toString('base64url');
}

export function getMagicTokenExpiry(): Date {
  const d = new Date();
  d.setMinutes(d.getMinutes() + TOKEN_EXPIRY_MIN);
  return d;
}

export async function createMagicLinkToken(
  email: string,
  requestIp?: string,
  userAgent?: string
): Promise<string> {
  const normalized = normalizeEmail(email);
  const token = generateMagicToken();
  const tokenHash = hashMagicToken(token);
  const expiresAt = getMagicTokenExpiry();

  await prisma.magicLinkToken.create({
    data: {
      email: normalized,
      tokenHash,
      expiresAt,
      requestIp,
      userAgent,
    },
  });

  return token;
}

export async function consumeMagicLinkToken(token: string): Promise<{ email: string } | null> {
  if (!token || token.length < 32) return null;
  const tokenHash = hashMagicToken(token);
  const now = new Date();

  const record = await prisma.magicLinkToken.findFirst({
    where: { tokenHash },
  });

  if (!record || record.usedAt || record.expiresAt < now) {
    return null;
  }

  await prisma.magicLinkToken.update({
    where: { id: record.id },
    data: { usedAt: now },
  });

  return { email: record.email };
}

export async function upsertUserAndIdentityForMagicLink(email: string): Promise<{
  userId: string;
  email: string;
  role: string;
}> {
  const normalized = normalizeEmail(email);

  const user = await prisma.user.upsert({
    where: { email: normalized },
    create: {
      email: normalized,
      // El Magic Link valida el mail, pero NO otorga roles admin por sí solo.
      // Los roles "premium/admin" se asignan por contraseña o por panel admin.
      role: 'BUYER',
    },
    // Si el usuario ya existe, preservamos su rol y vigencias para no pisar historial.
    update: {},
  });

  await prisma.userIdentity.upsert({
    where: {
      provider_providerUserId: {
        provider: 'magic_link' as IdentityProvider,
        providerUserId: normalized,
      },
    },
    create: {
      userId: user.id,
      provider: 'magic_link',
      providerUserId: normalized,
      email: normalized,
      emailVerified: true,
    },
    update: {},
  });

  return {
    userId: user.id,
    email: user.email,
    role: user.role,
  };
}
