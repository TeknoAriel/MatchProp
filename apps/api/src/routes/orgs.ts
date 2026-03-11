import { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma.js';
import { ActivationReason, OrgRole } from '@prisma/client';
import { LeadStatus } from '@prisma/client';
import { config } from '../config.js';
import { processLeadActivatedEvent } from '../services/lead-delivery/processor.js';
import { trackEvent } from '../lib/analytics.js';

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export async function orgRoutes(fastify: FastifyInstance) {
  fastify.post(
    '/orgs',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['Orgs'],
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          required: ['name'],
          properties: { name: { type: 'string', minLength: 1 } },
        },
        response: {
          201: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              name: { type: 'string' },
              slug: { type: 'string' },
            },
          },
        },
      },
    },
    async (request) => {
      const user = request.user as { userId: string };
      const body = request.body as { name: string };
      const slug = slugify(body.name);
      const existing = await prisma.organization.findUnique({ where: { slug } });
      if (existing) {
        throw fastify.httpErrors.conflict('Ya existe una organización con ese nombre');
      }
      const org = await prisma.organization.create({
        data: {
          name: body.name,
          slug,
          members: {
            create: {
              userId: user.userId,
              role: OrgRole.owner,
            },
          },
        },
      });
      return { id: org.id, name: org.name, slug: org.slug };
    }
  );

  fastify.get(
    '/orgs/:orgId/members',
    {
      preHandler: [
        fastify.authenticate,
        fastify.requireOrgRole('orgId', [OrgRole.owner, OrgRole.org_admin, OrgRole.agent]),
      ],
      schema: {
        tags: ['Orgs'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['orgId'],
          properties: { orgId: { type: 'string' } },
        },
        response: {
          200: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                userId: { type: 'string' },
                email: { type: 'string' },
                role: { type: 'string' },
              },
            },
          },
        },
      },
    },
    async (request) => {
      const { orgId } = request.params as { orgId: string };
      const members = await prisma.orgMember.findMany({
        where: { orgId },
        include: { user: true },
      });
      return members.map((m) => ({
        userId: m.userId,
        email: m.user.email,
        role: m.role,
      }));
    }
  );

  fastify.patch(
    '/orgs/:orgId/members/:userId',
    {
      preHandler: [
        fastify.authenticate,
        fastify.requireOrgRole('orgId', [OrgRole.owner, OrgRole.org_admin]),
      ],
      schema: {
        tags: ['Orgs'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['orgId', 'userId'],
          properties: { orgId: { type: 'string' }, userId: { type: 'string' } },
        },
        body: {
          type: 'object',
          required: ['role'],
          properties: { role: { type: 'string', enum: ['owner', 'org_admin', 'agent'] } },
        },
        response: { 200: { type: 'object', properties: { ok: { type: 'boolean' } } } },
      },
    },
    async (request) => {
      const { orgId, userId } = request.params as { orgId: string; userId: string };
      const body = request.body as { role: string };
      const currentUser = request.user as { userId: string };
      const membership = await prisma.orgMember.findUnique({
        where: { orgId_userId: { orgId, userId } },
      });
      if (!membership) {
        throw fastify.httpErrors.notFound('Miembro no encontrado');
      }
      if (membership.role === OrgRole.owner && userId !== currentUser.userId) {
        throw fastify.httpErrors.forbidden('Solo el owner puede cambiar su propio rol');
      }
      const newRole = body.role as OrgRole;
      await prisma.orgMember.update({
        where: { orgId_userId: { orgId, userId } },
        data: { role: newRole },
      });
      return { ok: true };
    }
  );

  fastify.get(
    '/orgs/:orgId/leads',
    {
      preHandler: [
        fastify.authenticate,
        fastify.requireOrgRole('orgId', [OrgRole.owner, OrgRole.org_admin, OrgRole.agent]),
      ],
      schema: {
        tags: ['Orgs'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['orgId'],
          properties: { orgId: { type: 'string' } },
        },
        response: {
          200: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                listingId: { type: 'string' },
                status: { type: 'string' },
                message: { type: 'string' },
                createdAt: { type: 'string' },
                listing: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    title: { type: 'string' },
                  },
                },
              },
            },
          },
        },
      },
    },
    async (request) => {
      const { orgId } = request.params as { orgId: string };
      const publisher = await prisma.publisher.findFirst({
        where: { type: 'ORG', orgId },
      });
      if (!publisher) return [];
      const leads = await prisma.lead.findMany({
        where: { publisherId: publisher.id },
        orderBy: { createdAt: 'desc' },
        include: {
          listing: { select: { id: true, title: true } },
        },
      });
      return leads.map((l) => ({
        id: l.id,
        listingId: l.listingId,
        status: l.status,
        message: l.message,
        createdAt: l.createdAt.toISOString(),
        listing: l.listing,
      }));
    }
  );

  // Sprint 9: Wallet B2B
  fastify.get(
    '/orgs/:orgId/wallet',
    {
      preHandler: [
        fastify.authenticate,
        fastify.requireOrgRole('orgId', [OrgRole.owner, OrgRole.org_admin, OrgRole.agent]),
      ],
      schema: {
        tags: ['Orgs', 'Wallet'],
        security: [{ bearerAuth: [] }],
        params: { type: 'object', required: ['orgId'], properties: { orgId: { type: 'string' } } },
        response: {
          200: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              orgId: { type: 'string' },
              balanceCents: { type: 'integer' },
              currency: { type: 'string' },
              transactions: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    amountCents: { type: 'integer' },
                    type: { type: 'string' },
                    referenceId: { type: ['string', 'null'] },
                    createdAt: { type: 'string' },
                  },
                },
              },
            },
          },
        },
      },
    },
    async (request) => {
      const { orgId } = request.params as { orgId: string };
      let wallet = await prisma.wallet.findUnique({
        where: { orgId },
        include: { transactions: { orderBy: { createdAt: 'desc' }, take: 50 } },
      });
      if (!wallet) {
        wallet = await prisma.wallet.create({
          data: { orgId },
          include: { transactions: true },
        });
      }
      return {
        id: wallet.id,
        orgId: wallet.orgId,
        balanceCents: wallet.balanceCents,
        currency: wallet.currency,
        transactions: wallet.transactions.map((t) => ({
          id: t.id,
          amountCents: t.amountCents,
          type: t.type,
          referenceId: t.referenceId,
          createdAt: t.createdAt.toISOString(),
        })),
      };
    }
  );

  fastify.post(
    '/orgs/:orgId/wallet/top-up',
    {
      preHandler: [
        fastify.authenticate,
        fastify.requireOrgRole('orgId', [OrgRole.owner, OrgRole.org_admin]),
      ],
      schema: {
        tags: ['Orgs', 'Wallet'],
        security: [{ bearerAuth: [] }],
        params: { type: 'object', required: ['orgId'], properties: { orgId: { type: 'string' } } },
        body: {
          type: 'object',
          required: ['amountCents'],
          properties: { amountCents: { type: 'integer', minimum: 1 } },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              balanceCents: { type: 'integer' },
              transactionId: { type: 'string' },
            },
          },
        },
      },
    },
    async (request) => {
      const { orgId } = request.params as { orgId: string };
      const body = request.body as { amountCents: number };
      if (body.amountCents <= 0) {
        throw fastify.httpErrors.badRequest('amountCents debe ser positivo');
      }
      const [w, tx] = await prisma.$transaction(async (pr) => {
        const wallet = await pr.wallet.upsert({
          where: { orgId },
          create: { orgId, balanceCents: body.amountCents },
          update: { balanceCents: { increment: body.amountCents } },
        });
        const t = await pr.walletTransaction.create({
          data: { walletId: wallet.id, amountCents: body.amountCents, type: 'TOP_UP' },
        });
        return [wallet, t];
      });
      return {
        id: w.id,
        balanceCents: w.balanceCents,
        transactionId: tx.id,
      };
    }
  );

  // Sprint 9: activar lead pagando con wallet de la org
  fastify.post(
    '/orgs/:orgId/leads/:leadId/activate',
    {
      preHandler: [
        fastify.authenticate,
        fastify.requireOrgRole('orgId', [OrgRole.owner, OrgRole.org_admin, OrgRole.agent]),
      ],
      schema: {
        tags: ['Orgs', 'Leads'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['orgId', 'leadId'],
          properties: { orgId: { type: 'string' }, leadId: { type: 'string' } },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              ok: { type: 'boolean' },
              status: { type: 'string' },
              activationReason: { type: 'string' },
              transactionId: { type: 'string' },
            },
          },
          402: { type: 'object', properties: { message: { type: 'string' } } },
        },
      },
    },
    async (request, reply) => {
      const user = request.user as { userId: string };
      const { orgId, leadId } = request.params as { orgId: string; leadId: string };
      const debitCents = config.leadDebitCents;

      const lead = await prisma.lead.findFirst({
        where: { id: leadId },
        include: {
          listing: { include: { publisher: true } },
          user: { select: { id: true } },
        },
      });
      if (!lead) throw fastify.httpErrors.notFound('Lead no encontrado');

      if (lead.status === LeadStatus.ACTIVE) {
        return reply.send({
          ok: true,
          status: 'ACTIVE',
          activationReason: lead.activationReason ?? 'PAID_BY_AGENCY',
          transactionId: '',
        });
      }

      if (lead.status === LeadStatus.CLOSED) {
        throw fastify.httpErrors.badRequest('No se puede activar un lead cerrado');
      }

      const publisher = lead.listing?.publisher;
      if (!publisher || publisher.type !== 'ORG' || publisher.orgId !== orgId) {
        throw fastify.httpErrors.forbidden('El lead no pertenece a esta organización');
      }

      const [, tx] = await prisma
        .$transaction(async (pr) => {
          const w = await pr.wallet.upsert({
            where: { orgId },
            create: { orgId, balanceCents: 0 },
            update: {},
          });
          if (w.balanceCents < debitCents) {
            throw new Error('INSUFFICIENT_BALANCE');
          }
          await pr.wallet.update({
            where: { id: w.id },
            data: { balanceCents: { decrement: debitCents } },
          });
          const t = await pr.walletTransaction.create({
            data: {
              walletId: w.id,
              amountCents: debitCents,
              type: 'DEBIT',
              referenceId: leadId,
            },
          });
          return [w, t];
        })
        .catch((e: unknown) => {
          if (e instanceof Error && e.message === 'INSUFFICIENT_BALANCE') {
            throw fastify.httpErrors.paymentRequired(
              `Saldo insuficiente. Se requieren ${debitCents} centavos. Recargá el wallet primero.`
            );
          }
          throw e;
        });

      const txId = tx!.id;

      await prisma.lead.update({
        where: { id: leadId },
        data: {
          status: LeadStatus.ACTIVE,
          activationReason: ActivationReason.PAID_BY_AGENCY,
          activatedAt: new Date(),
        },
      });

      const evActivated = await prisma.outboxEvent.create({
        data: { type: 'LEAD_ACTIVATED', payload: { leadId } },
      });
      await processLeadActivatedEvent(evActivated.id);
      await trackEvent('lead_activated', {
        userId: user.userId,
        payload: { leadId, activationReason: 'PAID_BY_AGENCY', orgId, transactionId: txId },
      });

      return reply.send({
        ok: true,
        status: 'ACTIVE',
        activationReason: 'PAID_BY_AGENCY',
        transactionId: txId,
      });
    }
  );

  fastify.delete(
    '/orgs/:orgId/members/:userId',
    {
      preHandler: [
        fastify.authenticate,
        fastify.requireOrgRole('orgId', [OrgRole.owner, OrgRole.org_admin]),
      ],
      schema: {
        tags: ['Orgs'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['orgId', 'userId'],
          properties: { orgId: { type: 'string' }, userId: { type: 'string' } },
        },
        response: { 200: { type: 'object', properties: { ok: { type: 'boolean' } } } },
      },
    },
    async (request) => {
      const { orgId, userId } = request.params as { orgId: string; userId: string };
      const currentUser = request.user as { userId: string };
      const membership = await prisma.orgMember.findUnique({
        where: { orgId_userId: { orgId, userId } },
      });
      if (!membership) {
        throw fastify.httpErrors.notFound('Miembro no encontrado');
      }
      if (membership.role === OrgRole.owner) {
        throw fastify.httpErrors.forbidden('No se puede remover al owner de la organización');
      }
      if (userId === currentUser.userId && membership.role === OrgRole.org_admin) {
        const owners = await prisma.orgMember.count({
          where: { orgId, role: OrgRole.owner },
        });
        if (owners <= 1) {
          throw fastify.httpErrors.forbidden(
            'No podés salirte si sos el único admin. Asigná otro admin primero.'
          );
        }
      }
      await prisma.orgMember.delete({
        where: { orgId_userId: { orgId, userId } },
      });
      return { ok: true };
    }
  );
}
