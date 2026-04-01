import Fastify, { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import sensible from '@fastify/sensible';
import underPressure from '@fastify/under-pressure';
import cors from '@fastify/cors';
import cookie from '@fastify/cookie';
import rateLimit from '@fastify/rate-limit';
import jwt from '@fastify/jwt';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import { formatDate } from '@matchprop/shared';
import { config, envFlag } from './config.js';
import authPlugin from './plugins/auth.js';
import { authRoutes } from './routes/auth.js';
import { webauthnRoutes } from './routes/webauthn.js';
import { orgRoutes } from './routes/orgs.js';
import { propertyRoutes } from './routes/properties.js';
import { preferenceRoutes } from './routes/preferences.js';
import { activeSearchRoutes } from './routes/active-search.js';
import { meMatchRoutes } from './routes/me-match.js';
import { feedRoutes } from './routes/feed.js';
import { swipeRoutes } from './routes/swipes.js';
import { savedRoutes } from './routes/saved.js';
import { listsRoutes } from './routes/lists.js';
import { leadRoutes } from './routes/leads.js';
import { listingRoutes } from './routes/listings.js';
import { publicListingRoutes } from './routes/public-listings.js';
import { assistantRoutes } from './routes/assistant.js';
import { searchesRoutes } from './routes/searches.js';
import { alertsRoutes } from './routes/alerts.js';
import { notificationsRoutes } from './routes/notifications.js';
import { profileRoutes } from './routes/profile.js';
import { orgInvitationsRoutes } from './routes/org-invitations.js';
import { integrationsRoutes } from './routes/integrations.js';
import { apiUniversalRoutes } from './routes/api-universal.js';
import { debugRoutes } from './routes/debug.js';
import { statusRoutes } from './routes/status.js';
import { cronRoutes } from './routes/cron.js';
import { subscriptionRoutes } from './routes/subscriptions.js';
import { paymentRoutes } from './routes/payments.js';
import { adminUsersRoutes } from './routes/admin-users.js';
import { adminBillingRoutes } from './routes/admin-billing.js';
import { adminStatsRoutes } from './routes/admin-stats.js';
import { prisma } from './lib/prisma.js';
import { registerProductionErrorHandler } from './lib/error-handler.js';

export async function buildApp(opts?: { logger?: boolean }): Promise<FastifyInstance> {
  const fastify = Fastify({ logger: opts?.logger ?? true });

  // under-pressure: 503 cuando event loop/heap superan umbrales.
  // En serverless (Vercel 1024MB) dejar margen para cold start; en dev/demo más holgado; en tests desactivar.
  const isTest = process.env.VITEST === 'true' || process.env.NODE_ENV === 'test';
  const isDev = envFlag('DEMO_MODE') || process.env.NODE_ENV !== 'production';
  const isVercel = process.env.VERCEL === '1';
  if (!isTest && !isVercel) {
    const heap = isDev ? 1024 * 1024 * 1024 : 512 * 1024 * 1024;
    await fastify.register(underPressure, {
      maxEventLoopDelay: 2000,
      maxHeapUsedBytes: heap,
      maxRssBytes: heap,
      message: 'Under pressure',
    });
  }

  await fastify.register(sensible);
  registerProductionErrorHandler(fastify);
  await fastify.register(cors, {
    origin: config.corsOrigins,
    credentials: true,
  });
  await fastify.register(cookie);
  await fastify.register(rateLimit, {
    max: 100,
    timeWindow: '1 minute',
  });
  await fastify.register(jwt, {
    secret: config.jwtSecret,
    cookie: { cookieName: 'access_token', signed: false },
  });
  await fastify.register(swagger, {
    openapi: {
      info: { title: 'MatchProp API', version: '1.0.0' },
      components: {
        securitySchemes: {
          bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
        },
      },
    },
  });
  await fastify.register(swaggerUi, { routePrefix: '/docs' });
  await fastify.register(fp(authPlugin));

  // Raw body para webhook Stripe (verificación de firma)
  fastify.addContentTypeParser('application/json', { parseAs: 'buffer' }, (req, body, done) => {
    const path = req.url?.split('?')[0] ?? '';
    const needsStripeRaw =
      path.startsWith('/webhooks/stripe') || path.startsWith('/payments/webhook/stripe');
    if (needsStripeRaw) {
      (req as { rawBody?: Buffer }).rawBody = Buffer.isBuffer(body) ? body : Buffer.from(body);
      done(null, body);
    } else {
      try {
        const str = body.toString();
        done(null, str && str.trim() ? JSON.parse(str) : {});
      } catch (e) {
        done(e as Error, undefined);
      }
    }
  });

  fastify.addHook('onRequest', (request, _reply, done) => {
    (request as { _startTime?: number })._startTime = Date.now();
    (request as { requestId?: string }).requestId =
      (request.headers['x-request-id'] as string) ||
      `req-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    done();
  });
  fastify.addHook('onResponse', (request, reply, done) => {
    const start = (request as { _startTime?: number })._startTime;
    const responseTime = start != null ? Date.now() - start : undefined;
    const requestId = (request as { requestId?: string }).requestId;
    const userId = (request.user as { userId?: string } | undefined)?.userId;
    const route =
      (request as { routeOptions?: { url?: string } }).routeOptions?.url ||
      (request as { routerPath?: string }).routerPath ||
      request.url;
    const logPayload: Record<string, unknown> = {
      requestId,
      route: `${request.method} ${route}`,
      statusCode: reply.statusCode,
      responseTime,
    };
    if (userId) logPayload.userId = userId;
    request.log.info(
      logPayload,
      `request ${request.method} ${route} ${reply.statusCode} ${responseTime ?? '?'}ms`
    );
    done();
  });

  const apiVersion = process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.APP_VERSION ?? 'local';

  fastify.get('/health', async (request, reply) => {
    let dbOk = false;
    let lastMigration: string | null = null;
    try {
      await prisma.$queryRaw`SELECT 1`;
      dbOk = true;
    } catch {
      request.log.warn('Health: DB check failed');
    }
    if (dbOk) {
      try {
        const rows = await prisma.$queryRaw<
          { migration_name: string }[]
        >`SELECT migration_name FROM _prisma_migrations ORDER BY finished_at DESC LIMIT 1`;
        lastMigration = rows[0]?.migration_name ?? null;
      } catch {
        // ignorar
      }
    }
    // Siempre 200; body indica ok vs degraded para que probes no bajen la instancia por DB temporal
    return reply.status(200).send({
      status: dbOk ? 'ok' : 'degraded',
      timestamp: formatDate(new Date()),
      db: dbOk ? 'ok' : 'error',
      version: apiVersion,
      migration: lastMigration,
    });
  });

  fastify.get('/version', async () => {
    let migration: string | null = null;
    try {
      const rows = await prisma.$queryRaw<
        { migration_name: string }[]
      >`SELECT migration_name FROM _prisma_migrations ORDER BY finished_at DESC LIMIT 1`;
      migration = rows[0]?.migration_name ?? null;
    } catch {
      // DB no disponible
    }
    return { version: apiVersion, commit: apiVersion, migration };
  });
  /** Diagnóstico: confirma que la ruta llegó bien (para depurar 404 Web→API en prod). */
  fastify.get('/status/connect', async (request) => ({
    ok: true,
    path: request.url,
    method: request.method,
    api: 'match-prop-api',
  }));
  fastify.get('/', async () => ({ message: 'MatchProp API', docs: '/docs' }));

  // Endpoint público para landing de listas compartidas (sin auth)
  fastify.get<{ Querystring: { ids?: string } }>(
    '/listings/share',
    {
      schema: {
        tags: ['Listings'],
        querystring: {
          type: 'object',
          properties: {
            ids: { type: 'string', description: 'IDs separados por coma' },
          },
        },
        response: {
          200: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                title: { type: ['string', 'null'] },
                price: { type: ['number', 'null'] },
                currency: { type: ['string', 'null'] },
                locationText: { type: ['string', 'null'] },
              },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const idsStr = request.query.ids;
      if (!idsStr || typeof idsStr !== 'string') {
        return reply.send([]);
      }
      const ids = idsStr
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
        .slice(0, 100);
      if (ids.length === 0) return reply.send([]);
      const listings = await prisma.listing.findMany({
        where: { id: { in: ids }, status: 'ACTIVE' },
        select: { id: true, title: true, price: true, currency: true, locationText: true },
      });
      const order = new Map(ids.map((id, i) => [id, i]));
      listings.sort((a, b) => (order.get(a.id) ?? 99) - (order.get(b.id) ?? 99));
      return reply.send(listings);
    }
  );

  await fastify.register(authRoutes);
  await fastify.register(webauthnRoutes);
  await fastify.register(orgRoutes);
  await fastify.register(propertyRoutes);
  await fastify.register(preferenceRoutes);
  await fastify.register(activeSearchRoutes);
  await fastify.register(meMatchRoutes);
  await fastify.register(feedRoutes);
  await fastify.register(swipeRoutes);
  await fastify.register(savedRoutes);
  await fastify.register(listsRoutes);
  await fastify.register(leadRoutes);
  await fastify.register(publicListingRoutes);
  await fastify.register(listingRoutes);
  await fastify.register(assistantRoutes, { prefix: '/assistant' });
  await fastify.register(searchesRoutes);
  await fastify.register(alertsRoutes, { prefix: '/alerts' });
  await fastify.register(notificationsRoutes);
  await fastify.register(profileRoutes);
  await fastify.register(orgInvitationsRoutes);
  await fastify.register(integrationsRoutes);
  await fastify.register(apiUniversalRoutes);
  await fastify.register(debugRoutes);
  await fastify.register(statusRoutes);
  await fastify.register(cronRoutes);
  await fastify.register(subscriptionRoutes);
  await fastify.register(paymentRoutes);
  await fastify.register(adminUsersRoutes);
  await fastify.register(adminBillingRoutes);
  await fastify.register(adminStatsRoutes);

  const { demoRoutes } = await import('./routes/demo.js');
  await fastify.register(demoRoutes);

  try {
    const { stripeRoutes } = await import('./routes/stripe.js');
    await fastify.register(stripeRoutes);
  } catch (e) {
    fastify.log.info({ err: e }, 'Stripe routes skipped');
  }

  fastify.addHook('onClose', async () => {
    await prisma.$disconnect();
  });

  return fastify;
}
