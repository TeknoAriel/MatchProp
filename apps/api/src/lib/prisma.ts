import { PrismaClient } from '@prisma/client';

const SLOW_QUERY_MS = 200;

/** Campos sensibles que NUNCA deben loguearse */
const SENSITIVE_KEYS = new Set(['password', 'passwordHash', 'token', 'secret', 'authorization']);

function safeHint(args: unknown): string {
  if (!args || typeof args !== 'object') return '';
  try {
    const obj = args as Record<string, unknown>;
    const safe: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) {
      const lower = k.toLowerCase();
      if (SENSITIVE_KEYS.has(lower) || lower.includes('password') || lower.includes('token'))
        continue;
      if (k === 'data' && typeof v === 'object' && v !== null) {
        const data = v as Record<string, unknown>;
        safe[k] = Object.keys(data).filter((dk) => !SENSITIVE_KEYS.has(dk.toLowerCase()));
      } else if (k === 'where' || k === 'select') {
        safe[k] = typeof v === 'object' ? Object.keys(v as object) : v;
      } else {
        safe[k] = v;
      }
    }
    return JSON.stringify(safe).slice(0, 150);
  } catch {
    return '';
  }
}

export const prisma = new PrismaClient();

prisma.$use(async (params, next) => {
  const before = Date.now();
  const result = await next(params);
  const duration = Date.now() - before;
  // No loguear en tests para no ensuciar el output
  if (process.env.NODE_ENV === 'test') return result;
  if (duration > SLOW_QUERY_MS) {
    const model = params.model ?? 'unknown';
    const action = params.action ?? 'unknown';
    const hint = safeHint(params.args);
    // eslint-disable-next-line no-console
    console.warn(
      `[Prisma SLOW] model=${model} action=${action} duration=${duration}ms ${hint ? `hint=${hint}` : ''}`
    );
  }
  return result;
});
