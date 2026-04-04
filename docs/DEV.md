# Notas de desarrollo — MatchProp

## Requisitos

- **Node** >= 18 (recomendado Node 20 LTS)
- **pnpm** 9
- **Docker** (PostgreSQL en `localhost:5432`)

Si usás `nvm`, ejecutá `nvm use` en la raíz del repo (lee `.nvmrc`).

## Comandos principales

| Comando            | Descripción                                              |
| ------------------ | -------------------------------------------------------- |
| `pnpm start`       | Levanta todo (alias de `dev:up`)                         |
| `pnpm start:check` | dev:up + typecheck + test:all + smoke:ux                 |
| `pnpm dev:up`      | Docker + migrate + seed + ingest + demo:data + API + Web |
| `pnpm dev:down`    | Apaga servicios                                          |
| `pnpm smoke:ux`    | Playwright E2E (firefox en Mac, chromium en Linux)       |

## Puertos

- **3000**: Web (Next.js)
- **3001**: API (Fastify)
- **5432**: PostgreSQL

## Usuarios admin (Kiteprop)

Los administradores con rol **ADMIN** son: **ariel@kiteprop.com**, **jonas@kiteprop.com**, **soporte@kiteprop.com**. El seed los crea o actualiza con `role: ADMIN` y contraseña **KiteProp123**. **Magic link está deshabilitado para esos emails** (deben entrar con **email + contraseña** en `/login`). Si ya existía el usuario con otro rol, ejecutá de nuevo el seed para forzar `role: ADMIN`: `pnpm --filter api run prisma:seed`.

### Magic link o demo “Link inválido” en local

- Si copiaste `apps/api/.env.local` desde Vercel, **`APP_URL` puede seguir siendo la URL de producción** mientras la **base de datos es local**: el link apuntaba a prod pero el token vivía en tu Postgres → fallaba al verificar. La API ahora **prioriza el header `Origin`** del navegador al armar el link (y CORS incluye `http://127.0.0.1:3000`).
- Si **`COOKIE_SECURE=true`** venía del mismo `.env`, las cookies no se guardaban en **http://**. En `NODE_ENV !== 'production'` las cookies de auth **no usan Secure**, aunque el flag venga en true.

## Planes liberados para pruebas

En desarrollo y pruebas las restricciones de plan premium están **liberadas** para no bloquear flujos:

- Con **DEMO_MODE=1** o **PREMIUM_FREE=1** o **NODE_ENV=development** se considera “premium free” y se permiten listas personalizadas, activación de leads, etc., sin exigir suscripción.
- El script `dev-local` añade **PREMIUM_FREE=1** a `apps/api/.env` si no existe.
- Cuando quieras aplicar las reglas de negocio (planes de pago), quitá PREMIUM_FREE y usá DEMO_MODE=0 en prod.

## Logs

- `.logs/api.log` — API
- `.logs/web.log` — Web

## Troubleshooting

### Puertos ocupados (3000/3001)

```bash
# Liberar puertos manualmente
lsof -iTCP:3000 -sTCP:LISTEN -t | xargs kill -9
lsof -iTCP:3001 -sTCP:LISTEN -t | xargs kill -9
```

O usar `pnpm dev:down` antes de volver a levantar.

### Playwright browser

- **macOS**: firefox (por `smoke-ux.sh`)
- **Linux**: chromium

Si falla instalación: `pnpm --filter web exec playwright install firefox` (o `chromium`).

### DB reset

```bash
docker compose down -v
pnpm dev:up
```

### Migraciones Prisma (IF NOT EXISTS)

Algunas migraciones usan `ADD COLUMN IF NOT EXISTS` y `CREATE TABLE IF NOT EXISTS` para ser idempotentes. Esto evita P3018 cuando una migración duplicada ya aplicó los cambios. Ver `apps/api/prisma/migrations/`.

## Brew / zprofile

Si ves un warning de Homebrew en tu `.zprofile` al abrir una terminal, no afecta al proyecto. Podés ignorarlo o seguir las instrucciones de brew. **No modificamos archivos del usuario** (~/.zprofile, ~/.zshrc).
