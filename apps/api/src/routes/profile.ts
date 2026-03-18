/**
 * GET /me/profile - Obtiene perfil del usuario (persona + org si aplica)
 * PATCH /me/profile - Actualiza perfil personal
 * PATCH /me/role - Actualiza tipo de usuario (BUYER|AGENT|REALTOR|INMOBILIARIA); aplica reglas de precios/planes
 * PATCH /me/password - Cambia contraseña (solo si tiene passwordHash)
 * GET /me/premium-tier - Información del plan y precios
 */
import { FastifyInstance } from 'fastify';
import bcrypt from 'bcryptjs';
import { prisma } from '../lib/prisma.js';
import { isKitepropAdmin } from '../lib/kiteprop-admins.js';

const PROFILE_FIELDS = [
  'firstName',
  'lastName',
  'dni',
  'matricula',
  'phone',
  'whatsapp',
  'telegram',
  'twitter',
  'instagram',
  'facebook',
  'website',
  'address',
  'avatarUrl',
] as const;

const ORG_FIELDS = [
  'name',
  'commercialName',
  'address',
  'phone',
  'whatsapp',
  'telegram',
  'twitter',
  'instagram',
  'facebook',
  'website',
] as const;

// Precios USD/mes por rol
export const PRICE_USD: Record<string, number> = {
  BUYER: 1,
  AGENT: 3,
  REALTOR: 5,
  INMOBILIARIA: 10,
};
const AGENT_ORG_DISCOUNT = 0.2; // 20% para agentes/corredores bajo inmobiliaria

export async function profileRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', fastify.authenticate);

  fastify.get(
    '/me/profile',
    {
      schema: {
        tags: ['Profile'],
        security: [{ bearerAuth: [] }],
        response: {
          200: {
            type: 'object',
            properties: {
              email: { type: 'string' },
              role: {
                type: 'string',
                enum: ['ADMIN', 'BUYER', 'AGENT', 'REALTOR', 'INMOBILIARIA'],
              },
              premiumUntil: { type: ['string', 'null'] },
              profile: {
                type: ['object', 'null'],
                properties: Object.fromEntries(
                  PROFILE_FIELDS.map((f) => [f, { type: ['string', 'null'] }])
                ),
              },
              organization: {
                type: ['object', 'null'],
                nullable: true,
                properties: Object.fromEntries(
                  ORG_FIELDS.map((f) => [f, { type: ['string', 'null'] }])
                ),
              },
              hasPassword: {
                type: 'boolean',
                description: 'Si puede cambiar contraseña (no OAuth-only)',
              },
            },
          },
        },
      },
    },
    async (request) => {
      const user = request.user as { userId: string };
      const u = await prisma.user.findUnique({
        where: { id: user.userId },
        include: {
          profile: true,
          organization: true,
        },
      });
      if (!u) throw fastify.httpErrors.unauthorized();
      const effectiveRole = isKitepropAdmin(u.email) ? 'ADMIN' : u.role;
      return {
        email: u.email,
        role: effectiveRole,
        premiumUntil: u.premiumUntil?.toISOString() ?? null,
        hasPassword: !!u.passwordHash,
        profile: u.profile
          ? Object.fromEntries(
              PROFILE_FIELDS.map((f) => [f, (u.profile as Record<string, unknown>)[f] ?? null])
            )
          : null,
        organization: u.organization
          ? Object.fromEntries(
              ORG_FIELDS.map((f) => [f, (u.organization as Record<string, unknown>)[f] ?? null])
            )
          : null,
      };
    }
  );

  fastify.patch(
    '/me/profile',
    {
      schema: {
        tags: ['Profile'],
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          properties: Object.fromEntries(
            PROFILE_FIELDS.map((f) => [f, { type: ['string', 'null'] }])
          ),
        },
        response: {
          200: {
            type: 'object',
            properties: { ok: { type: 'boolean' } },
          },
        },
      },
    },
    async (request, reply) => {
      const user = request.user as { userId: string };
      const body = request.body as Record<string, string | null | undefined>;
      const data: Record<string, string | null> = {};
      for (const f of PROFILE_FIELDS) {
        if (body[f] !== undefined) {
          data[f] = typeof body[f] === 'string' ? body[f].trim() || null : null;
        }
      }
      await prisma.userProfile.upsert({
        where: { userId: user.userId },
        create: { userId: user.userId, ...data },
        update: data,
      });
      return reply.send({ ok: true });
    }
  );

  const ALLOWED_ROLES = ['BUYER', 'AGENT', 'REALTOR', 'INMOBILIARIA'] as const;
  fastify.patch(
    '/me/role',
    {
      schema: {
        tags: ['Profile'],
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          required: ['role'],
          properties: {
            role: { type: 'string', enum: ALLOWED_ROLES },
          },
        },
        response: {
          200: { type: 'object', properties: { ok: { type: 'boolean' } } },
          400: { type: 'object', properties: { message: { type: 'string' } } },
        },
      },
    },
    async (request, reply) => {
      const user = request.user as { userId: string };
      const body = request.body as { role: string };
      if (!ALLOWED_ROLES.includes(body.role as (typeof ALLOWED_ROLES)[number])) {
        return reply.status(400).send({ message: 'Rol no permitido' });
      }
      await prisma.user.update({
        where: { id: user.userId },
        data: { role: body.role as (typeof ALLOWED_ROLES)[number] },
      });
      return reply.send({ ok: true });
    }
  );

  fastify.patch(
    '/me/organization',
    {
      schema: {
        tags: ['Profile'],
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          properties: Object.fromEntries(ORG_FIELDS.map((f) => [f, { type: ['string', 'null'] }])),
        },
        response: {
          200: { type: 'object', properties: { ok: { type: 'boolean' } } },
          400: { type: 'object', properties: { message: { type: 'string' } } },
        },
      },
    },
    async (request, reply) => {
      const user = request.user as { userId: string };
      const u = await prisma.user.findUnique({
        where: { id: user.userId },
        select: { role: true, organizationId: true },
      });
      if (!u) throw fastify.httpErrors.unauthorized();
      if (u.role !== 'INMOBILIARIA' || !u.organizationId) {
        return reply.status(400).send({
          message: 'Solo las cuentas de inmobiliaria pueden editar los datos de la organización.',
        });
      }
      const body = request.body as Record<string, string | null | undefined>;
      const data: Record<string, string | null> = {};
      for (const f of ORG_FIELDS) {
        if (body[f] !== undefined) {
          data[f] = typeof body[f] === 'string' ? body[f].trim() || null : null;
        }
      }
      if (Object.keys(data).length === 0) {
        return reply.send({ ok: true });
      }
      await prisma.organization.update({
        where: { id: u.organizationId },
        data,
      });
      return reply.send({ ok: true });
    }
  );

  fastify.patch(
    '/me/password',
    {
      schema: {
        tags: ['Profile'],
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          required: ['currentPassword', 'newPassword'],
          properties: {
            currentPassword: { type: 'string', minLength: 1 },
            newPassword: { type: 'string', minLength: 8 },
          },
        },
        response: {
          200: { type: 'object', properties: { ok: { type: 'boolean' } } },
          400: { type: 'object', properties: { message: { type: 'string' } } },
        },
      },
    },
    async (request, reply) => {
      const user = request.user as { userId: string };
      const body = request.body as { currentPassword: string; newPassword: string };
      const u = await prisma.user.findUnique({
        where: { id: user.userId },
        select: { passwordHash: true },
      });
      if (!u) throw fastify.httpErrors.unauthorized();
      if (!u.passwordHash) {
        return reply.status(400).send({
          message:
            'Tu cuenta no tiene contraseña (iniciaste sesión con Google/Apple/etc). Usá la opción de recuperar contraseña para crear una.',
        });
      }
      const valid = await bcrypt.compare(body.currentPassword, u.passwordHash);
      if (!valid) {
        return reply.status(400).send({ message: 'Contraseña actual incorrecta' });
      }
      const newHash = await bcrypt.hash(body.newPassword, 10);
      await prisma.user.update({
        where: { id: user.userId },
        data: { passwordHash: newHash },
      });
      return reply.send({ ok: true });
    }
  );

  fastify.get(
    '/me/premium-tier',
    {
      schema: {
        tags: ['Profile'],
        security: [{ bearerAuth: [] }],
        response: {
          200: {
            type: 'object',
            properties: {
              role: { type: 'string' },
              isPremium: { type: 'boolean' },
              premiumUntil: { type: ['string', 'null'] },
              priceUsd: { type: 'number' },
              hasOrgDiscount: { type: 'boolean' },
              canCreateLists: { type: 'boolean' },
              tiers: {
                type: 'object',
                properties: {
                  BUYER: { type: 'number', description: '1 USD - like y favorito' },
                  AGENT: { type: 'number', description: '3 USD - listas personalizadas' },
                  REALTOR: { type: 'number', description: '5 USD' },
                  INMOBILIARIA: { type: 'number', description: '10 USD' },
                },
              },
            },
          },
        },
      },
    },
    async (request) => {
      const user = request.user as { userId: string };
      const u = await prisma.user.findUnique({
        where: { id: user.userId },
        select: { role: true, premiumUntil: true, organizationId: true },
      });
      if (!u) throw fastify.httpErrors.unauthorized();
      const isPremium = !!(u.premiumUntil && u.premiumUntil > new Date());
      const hasOrgDiscount = !!(u.role === 'AGENT' || u.role === 'REALTOR') && !!u.organizationId;
      let priceUsd = PRICE_USD[u.role] ?? 1;
      if (hasOrgDiscount) {
        priceUsd = Math.round(priceUsd * (1 - AGENT_ORG_DISCOUNT) * 100) / 100;
      }
      const canCreateLists =
        isPremium && (u.role === 'AGENT' || u.role === 'REALTOR' || u.role === 'INMOBILIARIA');
      return {
        role: u.role,
        isPremium,
        premiumUntil: u.premiumUntil?.toISOString() ?? null,
        priceUsd,
        hasOrgDiscount,
        canCreateLists,
        tiers: PRICE_USD,
      };
    }
  );
}
