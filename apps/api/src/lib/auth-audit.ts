import { prisma } from './prisma.js';
import type { AuthAuditEvent } from '@prisma/client';

export interface AuditInput {
  event: AuthAuditEvent;
  userId?: string;
  email?: string;
  provider?: string;
  ip?: string;
  userAgent?: string;
}

export async function logAuthAudit(input: AuditInput): Promise<void> {
  try {
    await prisma.authAuditLog.create({
      data: {
        event: input.event,
        userId: input.userId,
        email: input.email,
        provider: input.provider,
        ip: input.ip,
        userAgent: input.userAgent,
      },
    });
  } catch (err) {
    /** Nunca bloquear login/demo/magic si el audit falla (DB, enum, etc.). */
    console.warn('[auth audit log]', err);
  }
}
