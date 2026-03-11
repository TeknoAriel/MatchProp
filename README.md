# MatchProp

Buscá propiedades deslizando. Match tipo Tinder, listas, alertas y consultas directas con inmobiliarias.

## Inicio rápido

1. **Docker Desktop** en ejecución.
2. `pnpm dev:up` (o `pnpm start` / `iniciar.command`).
3. Esperá 2–3 min. Se abre http://localhost:3000/login.
4. Usuario demo: **smoke-ux@matchprop.com** → "Abrir link de acceso (dev)".

---

## Estructura

```
apps/
  web/        → Next.js 15 (puerto 3000) — App principal
  api/        → Fastify + Prisma (puerto 3001)
  admin/      → Next.js (puerto 3002)
  mobile/     → React Native Expo
packages/
  shared/     → Tipos y utilidades compartidas
```

Documentación: [ARCHITECTURE.md](docs/ARCHITECTURE.md) | [DEPLOY.md](docs/DEPLOY.md) | [SCALABILITY.md](docs/SCALABILITY.md)

## Requisitos

- **Node.js** >= 18 (recomendado Node 20 LTS)
- **pnpm** >= 9

### Instalar pnpm

```bash
npm install -g pnpm
```

Ver también [docs/DEV.md](docs/DEV.md) para notas de desarrollo (Node, brew, migraciones).

## Instalación

```bash
pnpm install
```

## Scripts

### Desarrollo

```bash
# Todas las apps en paralelo
pnpm dev

# Por separado
pnpm dev:api     # API en http://localhost:3001
pnpm dev:admin   # Admin en http://localhost:3002
pnpm dev:mobile  # Expo (escanear QR con Expo Go)
```

### Build

```bash
# Build de todo (shared primero, luego apps)
pnpm build

# Por paquete
pnpm build:shared
pnpm build:api
pnpm build:admin
pnpm build:mobile
```

### Deploy y revisión final

```bash
pnpm run deploy:pre         # Migraciones (antes de start en prod)
pnpm run pre-deploy:verify  # Build + typecheck + test:all
pnpm smoke:ux               # E2E (con servicios levantados)
```

Ver **[docs/PROD.md](docs/PROD.md)** para checklist pre-deploy y **[docs/DEPLOY.md](docs/DEPLOY.md)** para producción y beta.

### Lint y formato

```bash
pnpm lint           # ESLint en todos los paquetes
pnpm format         # Prettier formatear
pnpm format:check   # Prettier verificar
```

## Base de datos (PostgreSQL)

```bash
docker compose up -d
```

Conexión: `postgresql://matchprop:matchprop@localhost:5432/matchprop`

### API - Prisma

```bash
pnpm --filter api run prisma:migrate   # Migraciones
pnpm --filter api run prisma:seed     # Seed idempotente
pnpm --filter api test                # Tests (vitest)
```

Usuarios demo:

- Admin: `admin@matchprop.com` / `demo`
- Agent: `demo@matchprop.com` / `demo`

## API - Comandos y verificación

### Comandos

```bash
pnpm --filter api run prisma:migrate
pnpm --filter api run prisma:seed
pnpm --filter api test          # Unit tests (sin DB)
pnpm --filter api run test:all  # Todos los tests (requiere DB)
pnpm --filter api dev
```

### Verificación global (sin levantar API)

```bash
pnpm -r typecheck   # TypeScript en todo el monorepo
pnpm -r test        # Unit tests
pnpm lint           # ESLint
```

### Curls de ejemplo

```bash
# 1. Health
curl -s http://localhost:3001/health | jq .

# 2. Login (obtener token)
TOKEN=$(curl -s -X POST http://localhost:3001/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"demo@matchprop.com","password":"demo"}' | jq -r '.token')

# 3. Feed página 1 (limit default 20, max 50)
curl -s "http://localhost:3001/feed?limit=5" -H "Authorization: Bearer $TOKEN" | jq .

# 4. Feed página 2 (usar nextCursor de la respuesta anterior; solo si no es null)
# El cursor es base64url opaco; copiarlo tal cual a la query
NEXT=$(curl -s "http://localhost:3001/feed?limit=5" -H "Authorization: Bearer $TOKEN" | jq -r '.nextCursor')
curl -s "http://localhost:3001/feed?limit=5&cursor=$NEXT" -H "Authorization: Bearer $TOKEN" | jq .
```

**Notas sobre el feed:**

- `limit`: default 20, máximo 50. Si se excede → 400 con `code: "INVALID_LIMIT"`.
- `cursor`: opaco en base64url. Si es inválido → 400 con `code: "INVALID_CURSOR"`.
- `includeTotal`: default 0. Si `includeTotal=1` (solo primera página, sin cursor): se hace COUNT y se cachea 30s. Si `includeTotal=0`: no se cuenta; `total` viene de cache o `null` (Tinder no necesita total).
- Respuesta: `{ items, total, limit, nextCursor }`. `total` puede ser `null` si `includeTotal=0` y sin cache. Items son cards livianas (id, title, price, mainImage, etc.) sin description/media completo.
- **Preferencias**: el feed usa la Preference del usuario como base. Query params (`operation`, `propertyType`, `minPrice`, `maxPrice`, etc.) hacen override. Si `minPrice > maxPrice` → 400 `INVALID_FILTERS`.

**Curls Feed + Preferences:**

```bash
# 1. Login
TOKEN=$(curl -s -X POST http://localhost:3001/auth/login -H "Content-Type: application/json" -d '{"email":"demo@matchprop.com","password":"demo"}' | jq -r '.token')

# 2. Guardar preferencias (operation SALE)
curl -s -X PUT http://localhost:3001/preferences \
  -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" \
  -d '{"operation":"SALE","minPrice":50000,"maxPrice":300000}' | jq .

# 3. Feed con preference (respeta SALE)
curl -s "http://localhost:3001/feed?limit=5" -H "Authorization: Bearer $TOKEN" | jq .

# 4. Feed con override (operation=RENT pisa preference)
curl -s "http://localhost:3001/feed?limit=5&operation=RENT" -H "Authorization: Bearer $TOKEN" | jq .
```

### Swagger UI

http://localhost:3001/docs — Click en "Authorize", pegá el token (solo el JWT), y probá los endpoints.

## Load tests (k6)

Requiere [k6](https://k6.io/docs/getting-started/installation/) instalado. En Mac: `curl -fsSL https://install-k6.com/please.sh | bash` (o `brew install k6`). Luego `exec zsh` para cargar el PATH.

**Terminal 1 (API):**

```bash
docker compose up -d
pnpm --filter api run prisma:migrate
pnpm --filter api run prisma:seed
pnpm --filter api dev
```

**Terminal 2 (stress):**

```bash
pnpm --filter api run load:feed    # Solo lectura feed
pnpm --filter api run load:mixed   # Mix: 70% feed, 20% swipes, 10% preferences
pnpm --filter api run load:bigdata # Feed + swipes con data grande
```

**Variables de entorno** (opcionales): `BASE_URL`, `EMAIL`, `PASSWORD`, `LIMIT`

```bash
BASE_URL=http://localhost:3001 LIMIT=20 pnpm --filter api run load:feed
```

**Stages por defecto:** 0→25 VUs (30s), 25→100 VUs (1m), 100 VUs (2m), 100→0 (30s)

### Big data stress (10k propiedades, 50 loadusers, ~250k swipes)

**Importante:** bigdata usa multi-token: rota entre `load@matchprop.com` (control, sin swipes) y `loaduser+001@matchprop.com` … `loaduser+050@matchprop.com` para simular tráfico real.

Generar data grande (idempotente):

```bash
SEED_PROPERTIES=10000 SEED_USERS=50 SWIPE_RATIO=0.5 SEED_RESET=1 pnpm --filter api run prisma:seed
```

Correr stress PEAK (desde raíz del repo):

```bash
USERS_COUNT=50 USER_PREFIX=loaduser PASSWORD=demo BASE_URL=http://localhost:3001 k6 run \
  --stage 30s:50 --stage 2m:200 --stage 5m:200 --stage 30s:0 apps/api/loadtest/bigdata.js
```

Soak (30 min):

```bash
USERS_COUNT=50 USER_PREFIX=loaduser PASSWORD=demo BASE_URL=http://localhost:3001 k6 run \
  --vus 150 --duration 30m apps/api/loadtest/bigdata.js
```

**Stages bigdata:** 0→50 (30s), 50→200 (2m), 200 (5m), 200→0 (30s). Al final se imprime **STATUS BREAKDOWN BY ENDPOINT** y se genera `summary-status.json`.

**Si falla:** cuello DB → índices, pool. Cuello Node → under-pressure. Acciones: 1) índices Prisma, 2) `connection_limit` en DATABASE_URL, 3) ajustar `maxEventLoopDelay` en app.ts.

### Monitoreo durante stress

- **Postgres:** `docker stats` (ver CPU/mem del contenedor postgres)
- **Logs API:** salida de `pnpm --filter api dev` (errores, 503 Under pressure)

### Pool de conexiones (si hay "too many connections" o timeouts)

Ajustar `DATABASE_URL` en `.env`:

```
DATABASE_URL="postgresql://matchprop:matchprop@localhost:5432/matchprop?connection_limit=10&pool_timeout=20"
```

### Interpretación de resultados

- **p95**: percentil 95 de latencia. Si supera el threshold (800ms feed, 1200ms mixed) → cuello de botella.
- **http_req_failed**: tasa de errores. >1% (feed) o >2% (mixed) → inestabilidad.
- **Bottleneck probable**: si p95 sube con VUs → DB (índices, pool). Si sube desde el inicio → Node (event loop, under-pressure).

**3 acciones si falla:**

1. **Aumentar índices**: verificar `Property(createdAt, price, operation+propertyType)` y `Swipe(userId+createdAt)`.
2. **Ajustar pool**: `connection_limit` y `pool_timeout` en DATABASE_URL.
3. **Ajustar under-pressure**: `maxEventLoopDelay`, `maxHeapUsedBytes` en `app.ts` (evitar crash, responde 503).

## Ejecutar localmente

1. **Instalar dependencias**

   ```bash
   pnpm install
   ```

2. **Build del paquete shared** (requerido antes de usar las apps)

   ```bash
   pnpm build:shared
   ```

3. **Desarrollo**

   ```bash
   pnpm dev
   ```

   O solo la app que necesites:

   ```bash
   pnpm dev:api
   pnpm dev:admin
   pnpm dev:mobile
   ```

4. **Producción**
   ```bash
   pnpm build
   pnpm --filter api start      # API
   pnpm --filter admin start    # Admin
   ```

## Start

```bash
pnpm start
```

## Start + Check

```bash
pnpm start:check
```

## Stop

```bash
pnpm dev:down
```

## Tecnologías

- **API**: Fastify, Prisma, PostgreSQL, TypeScript, Zod, JWT, Swagger
- **Admin**: Next.js 15, React 18, Tailwind CSS
- **Mobile**: React Native, Expo 52
- **Shared**: TypeScript (tipos y utils)
