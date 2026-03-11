# Auth v2 — Arquitectura y Documentación

## Resumen

Sistema de autenticación con sesiones seguras (access + refresh con rotación), Magic Link, OAuth (Google, Apple, Facebook), Passkeys (WebAuthn), Identities link/unlink, y RBAC con orgs.

## Arquitectura

### Sesiones

- **Access token**: JWT, 15 min de vida, en cookie `access_token` o header `Authorization: Bearer`
- **Refresh token**: string aleatorio, 30 días, guardado como hash SHA-256 en `Session`
- **Rotación**: cada refresh emite nuevo refresh y revoca el anterior
- **Cookies**: httpOnly, secure en prod, sameSite=lax

### Endpoints base

| Método | Ruta           | Descripción                               |
| ------ | -------------- | ----------------------------------------- |
| POST   | /auth/register | Registro email+password, crea sesión      |
| POST   | /auth/login    | Login email+password, crea sesión         |
| POST   | /auth/logout   | Revoca sesión, limpia cookies             |
| POST   | /auth/refresh  | Rota refresh, emite access+refresh nuevos |
| GET    | /me            | Usuario actual + org memberships          |
| GET    | /auth/me       | Alias de /me                              |

### Magic Link

| Método | Ruta                 | Descripción                                          |
| ------ | -------------------- | ---------------------------------------------------- |
| POST   | /auth/magic/request  | Envía link por email (anti-enumeración: siempre 200) |
| GET    | /auth/magic/callback | Callback con token, crea sesión, redirect            |
| POST   | /auth/magic/verify   | Verifica token, crea sesión, devuelve tokens         |

### OAuth (Google, Apple, Facebook)

| Método | Ruta                           | Descripción                                                        |
| ------ | ------------------------------ | ------------------------------------------------------------------ |
| GET    | /auth/oauth/:provider          | Redirige al provider (state + PKCE si aplica)                      |
| GET    | /auth/oauth/:provider/callback | Callback: intercambia code, upsert user/identity, sesión, redirect |

Flujo: el cliente abre `/auth/oauth/google` (o apple/facebook) en la misma pestaña; la API redirige al provider; tras login, el provider redirige a callback; la API crea/vincula usuario, sesión, cookies, y redirige a `OAUTH_SUCCESS_REDIRECT_URL` (por defecto `/dashboard`).

### Passkeys (WebAuthn)

| Método | Ruta                            | Descripción                                     |
| ------ | ------------------------------- | ----------------------------------------------- |
| POST   | /auth/webauthn/register/options | Devuelve options + challenge para registro      |
| POST   | /auth/webauthn/register/verify  | Verifica attestation, crea credential, sesión   |
| POST   | /auth/webauthn/login/options    | Devuelve options + challenge para autenticación |
| POST   | /auth/webauthn/login/verify     | Verifica assertion, actualiza counter, sesión   |

Librería: `@simplewebauthn/server` (API) y `@simplewebauthn/browser` (web).

### Identities (link/unlink)

| Método | Ruta                    | Descripción                                     |
| ------ | ----------------------- | ----------------------------------------------- |
| GET    | /auth/identities        | Lista identidades del usuario (requiere sesión) |
| POST   | /auth/identities/unlink | Desvincula identity (no si es último método)    |

Regla de seguridad: no se permite unlink si sería el último método de login (identities + passkeys).

### Orgs

| Método | Ruta                         | Descripción                                     |
| ------ | ---------------------------- | ----------------------------------------------- |
| POST   | /orgs                        | Crea org + membership OWNER para el user actual |
| GET    | /orgs/:orgId/members         | Lista miembros (require org role)               |
| PATCH  | /orgs/:orgId/members/:userId | Cambia role del miembro (owner/org_admin)       |
| DELETE | /orgs/:orgId/members/:userId | Remueve miembro (no owner)                      |

### Seguridad

- Rate limit global: 100 req/min
- Rate limit auth (magic, refresh, oauth, webauthn): 10 req/min
- Anti-enumeración en magic/request
- Auditoría: `AuthAuditLog` para magic_requested, magic_verified, oauth_login, passkey_registered, passkey_login, identity_unlinked, logout, refresh_rotated

## Variables de entorno

```env
# JWT y sesiones
JWT_SECRET="..."
AUTH_JWT_SECRET="..."          # opcional, override
AUTH_REFRESH_SECRET="..."      # opcional

# URLs
APP_URL="http://localhost:3000"
API_PUBLIC_URL="http://localhost:3001"  # base para links de magic link

# Cookies
COOKIE_SECURE="true"           # en producción

# Rate limit auth
AUTH_RATE_LIMIT_MAX="10"
AUTH_RATE_LIMIT_WINDOW_MS="60000"

# OAuth
OAUTH_SUCCESS_REDIRECT_URL="http://localhost:3000/dashboard"
OAUTH_FAILURE_REDIRECT_URL="http://localhost:3000/login?error=oauth"
OAUTH_CALLBACK_BASE_URL="http://localhost:3001"   # base para callback (API)
GOOGLE_CLIENT_ID="..."
GOOGLE_CLIENT_SECRET="..."
APPLE_CLIENT_ID="..."
APPLE_TEAM_ID="..."
APPLE_KEY_ID="..."
APPLE_PRIVATE_KEY="..."        # multiline soportado
FACEBOOK_CLIENT_ID="..."
FACEBOOK_CLIENT_SECRET="..."

# WebAuthn / Passkeys
WEBAUTHN_RP_ID="localhost"     # en dev; dominio en prod
WEBAUTHN_RP_NAME="MatchProp"
WEBAUTHN_ORIGIN="http://localhost:3000"
```

## Tests

```bash
pnpm -r typecheck
pnpm -r test
pnpm --filter api test:all
```

Los tests de integración usan `fastify.inject()`, no levantan servidor. El mailer en tests es in-memory (`getLastMagicLinkForEmail`).
