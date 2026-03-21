# Manejo de errores en producción (reglas estrictas)

Objetivo: respuestas predecibles para el cliente, **sin fugas** de implementación, y **observabilidad** completa en logs.

## 1. Respuesta HTTP

| Situación                               | Código              | Cuerpo al cliente                                          |
| --------------------------------------- | ------------------- | ---------------------------------------------------------- |
| Validación de schema / query inválida   | **400**             | `message` genérico; `requestId` si aplica. Sin stack.      |
| Auth / permisos / recurso no encontrado | **401 / 403 / 404** | Mensaje ya curado en la ruta (`httpErrors.*`).             |
| Conflicto de negocio                    | **409**             | Mensaje curado.                                            |
| Fallo inesperado (DB, bug, dependencia) | **500**             | Solo mensaje genérico (**“Error interno del servidor.”**). |

## 2. Prohibido en producción (`NODE_ENV=production` o `VERCEL=1`)

- Enviar **stack traces** al cliente.
- Enviar **mensajes de excepción interna** (Prisma, timeouts, paths de archivos).
- Incluir en JSON campos tipo `debug.internal`, `sql`, `err.message` crudo en handlers edge (Vercel).

En **desarrollo** puede incluirse `detail` para depuración local.

## 3. Obligatorio

- **Registrar** todo 5xx con `request.log.error` incluyendo `err`, `requestId`, ruta y método.
- **4xx** esperados: `request.log.info` o `warn` según severidad (no spamear como error).
- Errores de validación: `warn` con `validation` en log (no en respuesta).
- Usar **`fastify.httpErrors.*`** para errores de negocio con mensajes seguros y localizados.
- Donde haya `catch`, **o** se traduce a un error HTTP explícito **o** se re-lanza para el `setErrorHandler` global — **no** devolver 200 con cuerpo vacío si hubo fallo real (enmascara incidentes).

## 4. Implementación en este repo

- **Fastify:** `registerProductionErrorHandler` en `apps/api/src/lib/error-handler.ts` (registrado desde `app.ts` tras `@fastify/sensible`).
- **Vercel / Node handler:** `apps/api/api/handler.js` — en producción no envía `detail` al cliente; solo `console.error` server-side.

## 5. Checklist en code review

- [ ] Nuevo endpoint: ¿los 4xx usan mensajes que un usuario puede entender sin filtrar datos?
- [ ] ¿Algún `catch` traga el error sin log?
- [ ] ¿Algún `reply.send` en error manual expone `String(err)`?
- [ ] Integraciones externas: ¿timeout y error mapeado a 502/503 con mensaje genérico?

## 6. Health

- `GET /health` devuelve **siempre 200** con `status: ok | degraded` para no tumbar el runtime por un fallo transitorio de DB; el campo `db` indica el estado.
