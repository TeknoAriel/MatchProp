import 'fastify';
import type { UserRole, OrgRole } from '@prisma/client';

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest) => Promise<void>;
    requireRole: (allowedRoles: UserRole[]) => (request: FastifyRequest) => Promise<void>;
    requireOrgRole: (
      orgId: string,
      allowedRoles: OrgRole[]
    ) => (request: FastifyRequest) => Promise<void>;
    httpErrors: {
      unauthorized: (message?: string) => Error;
      forbidden: (message?: string) => Error;
      notFound: (message?: string) => Error;
      conflict: (message?: string) => Error;
      badRequest: (message?: string) => Error;
    };
  }
  interface FastifyRequest {
    user?: { userId: string; email: string; role: UserRole };
  }
}
