import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../../app.js';

describe('error handler (producción / consistencia)', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp({ logger: false });
    app.get('/__test_client', async () => {
      throw app.httpErrors.notFound('Recurso no encontrado');
    });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('5xx: respuesta JSON con mensaje genérico (sin mensaje interno en body)', async () => {
    const prev = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    const fresh = await buildApp({ logger: false });
    fresh.get('/__boom', async () => {
      throw new Error('SECRET_INTERNAL');
    });
    await fresh.ready();
    const res = await fresh.inject({ method: 'GET', url: '/__boom' });
    process.env.NODE_ENV = prev;
    await fresh.close();

    expect(res.statusCode).toBe(500);
    const body = res.json() as { message?: string; detail?: string; requestId?: string };
    expect(body.message).toBe('Error interno del servidor.');
    expect(body.requestId).toBeDefined();
    expect(JSON.stringify(body)).not.toContain('SECRET_INTERNAL');
  });

  it('4xx: preserva mensaje seguro del httpError', async () => {
    const res = await app.inject({ method: 'GET', url: '/__test_client' });
    expect(res.statusCode).toBe(404);
    const body = res.json() as { message?: string };
    expect(body.message).toBe('Recurso no encontrado');
  });
});
