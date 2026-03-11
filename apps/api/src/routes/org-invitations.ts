/**
 * Invitaciones de inmobiliaria a agentes/corredores.
 * POST /me/organization/invitations - Crear invitación (solo INMOBILIARIA)
 * GET /me/organization/invitations - Listar invitaciones de mi org
 * GET /invitations/:token - Ver detalle de invitación (público)
 * POST /invitations/:token/accept - Aceptar invitación (auth)
 */
import crypto from 'node:crypto';
import { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma.js';
import { OrgRole, UserRole } from '@prisma/client';

const INVITATION_EXPIRES_DAYS = 7;

function generateToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

export async function orgInvitationsRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', async (request) => {
    const url = request.url?.split('?')[0] ?? '';
    if (request.method === 'GET' && url.startsWith('/invitations/')) return;
    return fastify.authenticate(request);
  });

  // Crear invitación — solo inmobiliaria con org
  fastify.post(
    '/me/organization/invitations',
    {
      schema: {
        tags: ['Org invitations'],
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          required: ['email', 'role'],
          properties: {
            email: { type: 'string', format: 'email' },
            role: { type: 'string', enum: ['AGENT', 'REALTOR'] },
          },
        },
        response: {
          201: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              email: { type: 'string' },
              role: { type: 'string' },
              token: { type: 'string' },
              expiresAt: { type: 'string' },
              inviteUrl: { type: 'string' },
            },
          },
          400: { type: 'object', properties: { message: { type: 'string' } } },
        },
      },
    },
    async (request, reply) => {
      const user = request.user as { userId: string };
      const body = request.body as { email: string; role: 'AGENT' | 'REALTOR' };
      const u = await prisma.user.findUnique({
        where: { id: user.userId },
        select: { role: true, organizationId: true },
      });
      if (!u) throw fastify.httpErrors.unauthorized();
      if (u.role !== 'INMOBILIARIA' || !u.organizationId) {
        return reply.status(400).send({
          message: 'Solo las cuentas de inmobiliaria pueden invitar agentes o corredores.',
        });
      }
      const email = body.email.trim().toLowerCase();
      const existing = await prisma.user.findUnique({
        where: { email },
        select: { organizationId: true },
      });
      if (existing?.organizationId === u.organizationId) {
        return reply.status(400).send({
          message: 'Ese usuario ya pertenece a tu inmobiliaria.',
        });
      }
      const pending = await prisma.orgInvitation.findFirst({
        where: { orgId: u.organizationId, email, usedAt: null },
      });
      if (pending && pending.expiresAt > new Date()) {
        return reply.status(400).send({
          message: 'Ya hay una invitación pendiente para ese email.',
        });
      }
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + INVITATION_EXPIRES_DAYS);
      const token = generateToken();
      const inv = await prisma.orgInvitation.create({
        data: {
          orgId: u.organizationId,
          email,
          role: body.role,
          token,
          expiresAt,
          createdById: user.userId,
        },
      });
      const baseUrl = process.env.APP_URL || 'http://localhost:3000';
      const inviteUrl = `${baseUrl}/join?token=${token}`;
      return reply.status(201).send({
        id: inv.id,
        email: inv.email,
        role: inv.role,
        token: inv.token,
        expiresAt: inv.expiresAt.toISOString(),
        inviteUrl,
      });
    }
  );

  // Listar invitaciones de mi org
  fastify.get(
    '/me/organization/invitations',
    {
      schema: {
        tags: ['Org invitations'],
        security: [{ bearerAuth: [] }],
        response: {
          200: {
            type: 'object',
            properties: {
              invitations: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    email: { type: 'string' },
                    role: { type: 'string' },
                    expiresAt: { type: 'string' },
                    usedAt: { type: ['string', 'null'] },
                    inviteUrl: { type: 'string' },
                  },
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
        select: { role: true, organizationId: true },
      });
      if (!u) throw fastify.httpErrors.unauthorized();
      if (u.role !== 'INMOBILIARIA' || !u.organizationId) {
        return { invitations: [] };
      }
      const list = await prisma.orgInvitation.findMany({
        where: { orgId: u.organizationId },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          email: true,
          role: true,
          expiresAt: true,
          usedAt: true,
          token: true,
        },
      });
      const baseUrl = process.env.APP_URL || 'http://localhost:3000';
      const invitations = list.map((i) => ({
        id: i.id,
        email: i.email,
        role: i.role,
        expiresAt: i.expiresAt.toISOString(),
        usedAt: i.usedAt?.toISOString() ?? null,
        inviteUrl: `${baseUrl}/join?token=${i.token}`,
      }));
      return { invitations };
    }
  );

  // Ver invitación por token (público)
  fastify.get(
    '/invitations/:token',
    {
      schema: {
        tags: ['Org invitations'],
        params: { type: 'object', required: ['token'], properties: { token: { type: 'string' } } },
        response: {
          200: {
            type: 'object',
            properties: {
              email: { type: 'string' },
              role: { type: 'string' },
              organizationName: { type: 'string' },
              expiresAt: { type: 'string' },
              valid: { type: 'boolean' },
            },
          },
          404: { type: 'object', properties: { message: { type: 'string' } } },
        },
      },
    },
    async (request, reply) => {
      const { token } = request.params as { token: string };
      const inv = await prisma.orgInvitation.findUnique({
        where: { token },
        include: { org: { select: { name: true, commercialName: true } } },
      });
      if (!inv) {
        return reply.status(404).send({ message: 'Invitación no encontrada' });
      }
      const valid = !inv.usedAt && inv.expiresAt > new Date();
      return {
        email: inv.email,
        role: inv.role,
        organizationName: inv.org.commercialName || inv.org.name,
        expiresAt: inv.expiresAt.toISOString(),
        valid,
      };
    }
  );

  // Aceptar invitación — requiere auth
  fastify.post(
    '/invitations/:token/accept',
    {
      schema: {
        tags: ['Org invitations'],
        security: [{ bearerAuth: [] }],
        params: { type: 'object', required: ['token'], properties: { token: { type: 'string' } } },
        response: {
          200: { type: 'object', properties: { ok: { type: 'boolean' } } },
          400: { type: 'object', properties: { message: { type: 'string' } } },
          404: { type: 'object', properties: { message: { type: 'string' } } },
        },
      },
    },
    async (request, reply) => {
      const user = request.user as { userId: string };
      const { token } = request.params as { token: string };
      const inv = await prisma.orgInvitation.findUnique({
        where: { token },
        include: { org: true },
      });
      if (!inv) {
        return reply.status(404).send({ message: 'Invitación no encontrada' });
      }
      if (inv.usedAt) {
        return reply.status(400).send({ message: 'Esta invitación ya fue utilizada' });
      }
      if (inv.expiresAt <= new Date()) {
        return reply.status(400).send({ message: 'Esta invitación expiró' });
      }
      const me = await prisma.user.findUnique({
        where: { id: user.userId },
        select: { email: true, organizationId: true, role: true },
      });
      if (!me) throw fastify.httpErrors.unauthorized();
      const emailNorm = me.email.trim().toLowerCase();
      if (emailNorm !== inv.email.trim().toLowerCase()) {
        return reply.status(400).send({
          message:
            'Esta invitación fue enviada a otro email. Iniciá sesión con el email de la invitación.',
        });
      }
      if (me.organizationId) {
        return reply.status(400).send({
          message: 'Ya pertenecés a una inmobiliaria.',
        });
      }
      const userRole = inv.role === 'AGENT' ? UserRole.AGENT : UserRole.REALTOR;
      await prisma.$transaction([
        prisma.user.update({
          where: { id: user.userId },
          data: { organizationId: inv.orgId, role: userRole },
        }),
        prisma.orgMember.upsert({
          where: {
            orgId_userId: { orgId: inv.orgId, userId: user.userId },
          },
          create: {
            orgId: inv.orgId,
            userId: user.userId,
            role: OrgRole.agent,
          },
          update: {},
        }),
        prisma.orgInvitation.update({
          where: { id: inv.id },
          data: { usedAt: new Date() },
        }),
      ]);
      return { ok: true };
    }
  );
}
