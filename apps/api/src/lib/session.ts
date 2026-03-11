import { randomBytes, createHash } from 'crypto';
import { prisma } from './prisma.js';
import type { UserRole } from '@prisma/client';

const REFRESH_EXPIRY_DAYS = 30;
const ACCESS_EXPIRY_MIN = 15;

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function generateRefreshToken(): string {
  return randomBytes(32).toString('base64url');
}

export function getRefreshExpiry(): Date {
  const d = new Date();
  d.setDate(d.getDate() + REFRESH_EXPIRY_DAYS);
  return d;
}

export function getAccessExpirySeconds(): number {
  return ACCESS_EXPIRY_MIN * 60;
}

export interface CreateSessionInput {
  userId: string;
  userAgent?: string;
  ip?: string;
}

export interface CreateSessionResult {
  sessionId: string;
  refreshToken: string;
  refreshTokenHash: string;
  expiresAt: Date;
}

export async function createSession(input: CreateSessionInput): Promise<CreateSessionResult> {
  const refreshToken = generateRefreshToken();
  const refreshTokenHash = hashToken(refreshToken);
  const expiresAt = getRefreshExpiry();

  const session = await prisma.session.create({
    data: {
      userId: input.userId,
      refreshTokenHash,
      userAgent: input.userAgent,
      ip: input.ip,
      expiresAt,
    },
  });

  return {
    sessionId: session.id,
    refreshToken,
    refreshTokenHash,
    expiresAt,
  };
}

export interface RotateSessionResult {
  sessionId: string;
  refreshToken: string;
  expiresAt: Date;
}

export async function rotateSession(
  refreshToken: string,
  userAgent?: string,
  ip?: string
): Promise<{ userId: string; result: RotateSessionResult } | null> {
  const refreshTokenHash = hashToken(refreshToken);
  const now = new Date();

  const session = await prisma.session.findFirst({
    where: { refreshTokenHash },
    include: { user: true },
  });

  if (!session || session.revokedAt || session.expiresAt < now) {
    return null;
  }

  const newRefreshToken = generateRefreshToken();
  const newHash = hashToken(newRefreshToken);
  const newExpiresAt = getRefreshExpiry();

  const newSession = await prisma.session.create({
    data: {
      userId: session.userId,
      refreshTokenHash: newHash,
      userAgent: userAgent ?? session.userAgent,
      ip: ip ?? session.ip,
      expiresAt: newExpiresAt,
      rotatedFromSessionId: session.id,
    },
  });

  await prisma.session.update({
    where: { id: session.id },
    data: { revokedAt: now },
  });

  return {
    userId: session.userId,
    result: {
      sessionId: newSession.id,
      refreshToken: newRefreshToken,
      expiresAt: newExpiresAt,
    },
  };
}

export async function revokeSession(sessionId: string): Promise<boolean> {
  const now = new Date();
  const updated = await prisma.session.updateMany({
    where: { id: sessionId },
    data: { revokedAt: now },
  });
  return updated.count > 0;
}

export async function revokeSessionByRefreshToken(refreshToken: string): Promise<boolean> {
  const hash = hashToken(refreshToken);
  const now = new Date();
  const updated = await prisma.session.updateMany({
    where: { refreshTokenHash: hash },
    data: { revokedAt: now },
  });
  return updated.count > 0;
}

export async function findSessionByRefreshToken(refreshToken: string): Promise<{
  sessionId: string;
  userId: string;
  email: string;
  role: UserRole;
} | null> {
  const hash = hashToken(refreshToken);
  const now = new Date();
  const session = await prisma.session.findFirst({
    where: { refreshTokenHash: hash },
    include: { user: true },
  });
  if (!session || session.revokedAt || session.expiresAt < now) {
    return null;
  }
  return {
    sessionId: session.id,
    userId: session.userId,
    email: session.user.email,
    role: session.user.role,
  };
}
