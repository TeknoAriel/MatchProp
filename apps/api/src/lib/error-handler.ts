import type { FastifyError, FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

/** Producción: Vercel y NODE_ENV=production no deben exponer detalles internos al cliente. */
export function isProductionRuntime(): boolean {
  return process.env.NODE_ENV === 'production' || process.env.VERCEL === '1';
}

function statusName(code: number): string {
  const map: Record<number, string> = {
    400: 'Bad Request',
    401: 'Unauthorized',
    403: 'Forbidden',
    404: 'Not Found',
    409: 'Conflict',
    429: 'Too Many Requests',
    503: 'Service Unavailable',
  };
  return map[code] ?? 'Error';
}

/**
 * Registro único de errores no capturados en la API.
 * - 4xx: mensaje del error (pensado para mensajes seguros / ya curados en rutas).
 * - 5xx: mensaje genérico; detalle solo en logs; nunca stack al cliente en prod.
 * - Validación de schema: 400 genérico (detalle opcional solo fuera de prod).
 */
export function registerProductionErrorHandler(fastify: FastifyInstance): void {
  const prod = isProductionRuntime();

  fastify.setErrorHandler((error: FastifyError, request: FastifyRequest, reply: FastifyReply) => {
    const requestId = (request as { requestId?: string }).requestId;

    if (reply.sent) {
      request.log.warn({ err: error, requestId }, 'Error tras respuesta ya enviada');
      return;
    }

    // Validación AJV / Fastify schema
    if (error.validation) {
      request.log.warn(
        { err: error, validation: error.validation, requestId },
        'Validación de request fallida'
      );
      const body: Record<string, unknown> = {
        statusCode: 400,
        error: 'Bad Request',
        message: 'Solicitud inválida',
        requestId,
      };
      if (!prod && error.message) {
        body.detail = error.message;
      }
      return reply.status(400).send(body);
    }

    const statusCode =
      typeof error.statusCode === 'number' && error.statusCode >= 400 ? error.statusCode : 500;

    if (statusCode >= 400 && statusCode < 500) {
      request.log.info(
        {
          statusCode,
          message: error.message,
          requestId,
          route: `${request.method} ${request.url}`,
        },
        'Error de cliente'
      );
      return reply.status(statusCode).send({
        statusCode,
        error: statusName(statusCode),
        message: error.message || 'Solicitud inválida',
        requestId,
      });
    }

    request.log.error(
      {
        err: error,
        requestId,
        route: `${request.method} ${request.url}`,
      },
      'Error de servidor no manejado'
    );

    const body: Record<string, unknown> = {
      statusCode: 500,
      error: 'Internal Server Error',
      message: 'Error interno del servidor.',
      requestId,
    };
    if (!prod && error.message) {
      body.detail = error.message;
    }

    return reply.status(500).send(body);
  });
}
