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
