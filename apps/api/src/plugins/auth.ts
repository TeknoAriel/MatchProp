import type { FastifyPluginAsync, FastifyRequest } from 'fastify';
import type { UserRole, OrgRole } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { isKitepropAdmin } from '../lib/kiteprop-admins.js';

const authPlugin: FastifyPluginAsync = async (fastify) => {
  fastify.decorate('authenticate', async function (request) {
    try {
      await request.jwtVerify();
    } catch {
      throw fastify.httpErrors.unauthorized('Unauthorized');
    }
  });

  fastify.decorate(
    'requireRole',
    (allowedRoles: UserRole[]) =>
      async function (this: typeof fastify, request: FastifyRequest) {
        const user = request.user as
          | { userId?: string; email?: string; role?: UserRole }
          | undefined;
        const role = user?.role;
        const isAdminByEmail =
          allowedRoles.includes('ADMIN' as UserRole) && isKitepropAdmin(user?.email);
        if (!isAdminByEmail && (!role || !allowedRoles.includes(role))) {
          throw this.httpErrors.forbidden('Forbidden');
        }
      }
  );

  fastify.decorate(
    'requireOrgRole',
    (paramKey: string, allowedRoles: OrgRole[]) =>
      async function (this: typeof fastify, request: FastifyRequest) {
        const user = request.user as
          | { userId?: string; email?: string; role?: UserRole }
          | undefined;
        const userId = user?.userId;
        if (!userId) throw this.httpErrors.unauthorized('Unauthorized');

        const params = request.params as Record<string, string>;
        const orgId = params?.[paramKey];
        if (!orgId) throw this.httpErrors.badRequest(`Missing param: ${paramKey}`);

        const globalAdmin = user?.role === 'ADMIN' || isKitepropAdmin(user?.email);
        if (globalAdmin) return;

        const membership = await prisma.orgMember.findUnique({
          where: { orgId_userId: { orgId, userId } },
        });

        if (!membership || !allowedRoles.includes(membership.role)) {
          throw this.httpErrors.forbidden('Forbidden');
        }
      }
  );
};

export default authPlugin;
