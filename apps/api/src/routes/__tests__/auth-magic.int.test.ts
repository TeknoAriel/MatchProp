import { createHash } from 'crypto';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../../app.js';
import { getLastMagicLinkForEmail, clearMailerStore } from '../../services/mailer/index.js';
import { prisma } from '../../lib/prisma.js';

function hashToken(t: string) {
  return createHash('sha256').update(t).digest('hex');
}

describe('Auth Magic Link integration', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeAll(async () => {
    app = await buildApp({ logger: false });
    clearMailerStore();
  });

  afterAll(async () => {
    await app.close();
  });

  it('magic request siempre responde 200 (anti-enumeración)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/auth/magic/request',
      payload: { email: 'noexiste@test.com' },
      headers: { 'content-type': 'application/json' },
    });
    expect(res.statusCode).toBe(200);

    const res2 = await app.inject({
      method: 'POST',
      url: '/auth/magic/request',
      payload: { email: 'existente@test.com' },
      headers: { 'content-type': 'application/json' },
    });
    expect(res2.statusCode).toBe(200);
  });

  it('magic verify crea usuario y sesión', async () => {
    const email = 'magic-new-user@test.com';
    const reqRes = await app.inject({
      method: 'POST',
      url: '/auth/magic/request',
      payload: { email },
      headers: { 'content-type': 'application/json' },
    });
    expect(reqRes.statusCode).toBe(200);

    const link = getLastMagicLinkForEmail(email);
    expect(link).toBeDefined();
    const url = new URL(link!);
    const token = url.searchParams.get('token');
    expect(token).toBeTruthy();

    const verifyRes = await app.inject({
      method: 'POST',
      url: '/auth/magic/verify',
      payload: { token },
      headers: { 'content-type': 'application/json' },
    });
    expect(verifyRes.statusCode).toBe(200);
    const body = verifyRes.json();
    expect(body.token).toBeDefined();
    expect(body.refreshToken).toBeDefined();
    expect(body.user).toBeDefined();
    expect(body.user.email).toBe(email);

    const meRes = await app.inject({
      method: 'GET',
      url: '/me',
      headers: { authorization: `Bearer ${body.token}` },
    });
    expect(meRes.statusCode).toBe(200);
    expect(meRes.json().email).toBe(email);
  });

  it('token one-time: segundo uso falla', async () => {
    const email = 'magic-once@test.com';
    await app.inject({
      method: 'POST',
      url: '/auth/magic/request',
      payload: { email },
      headers: { 'content-type': 'application/json' },
    });
    const link = getLastMagicLinkForEmail(email);
    const token = new URL(link!).searchParams.get('token')!;

    const first = await app.inject({
      method: 'POST',
      url: '/auth/magic/verify',
      payload: { token },
      headers: { 'content-type': 'application/json' },
    });
    expect(first.statusCode).toBe(200);

    const second = await app.inject({
      method: 'POST',
      url: '/auth/magic/verify',
      payload: { token },
      headers: { 'content-type': 'application/json' },
    });
    expect(second.statusCode).toBe(401);
  });

  it('token expirado falla', async () => {
    const email = 'magic-expired@test.com';
    const rawToken = `expired-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const tokenHash = hashToken(rawToken);
    await prisma.magicLinkToken.create({
      data: {
        email,
        tokenHash,
        expiresAt: new Date(Date.now() - 60000),
      },
    });

    const res = await app.inject({
      method: 'POST',
      url: '/auth/magic/verify',
      payload: { token: rawToken },
      headers: { 'content-type': 'application/json' },
    });
    expect(res.statusCode).toBe(401);
  });
});
