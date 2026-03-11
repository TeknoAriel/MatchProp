# Guía de implementación — MatchProp v1.0

**Documento para el desarrollador fullstack que desplegará la aplicación.**

---

## 1. Resumen del proyecto

MatchProp es una plataforma de búsqueda inmobiliaria con:

- **Feed tipo Tinder** (swipe like/nope, undo)
- **Lista** de propiedades con filtros
- **Asistente de búsqueda** (texto y voz)
- **Búsquedas guardadas** y alertas
- **Consultas** (leads) con chat y agenda de visitas
- **Premium** vía Stripe (B2C)

**Stack:** Node 18+, pnpm, TypeScript, Fastify, Prisma, PostgreSQL, Next.js 15, React 18.

---

## 2. Estructura del paquete

```
MatchProp/
├── apps/
│   ├── api/          → API REST (Fastify + Prisma), puerto 3001
│   ├── web/          → Frontend Next.js, puerto 3000
│   └── admin/        → Panel admin Next.js, puerto 3002
├── packages/
│   └── shared/       → Tipos y utilidades compartidos
├── prisma/           → Schema y migraciones (en apps/api)
├── docs/             → Documentación
├── scripts/          → Scripts de deploy y dev
├── README.md
├── INSTRUCCIONES.md
├── package.json
└── pnpm-workspace.yaml
```

---

## 3. Requisitos del servidor

- **Node.js** >= 18 (recomendado 20 LTS)
- **pnpm** >= 9
- **PostgreSQL** 14+
- **Docker** (opcional, para base de datos)

---

## 4. Instalación y configuración

### 4.1 Dependencias

```bash
pnpm install
```

### 4.2 Base de datos

PostgreSQL debe estar accesible. Crear base de datos `matchprop` y usuario.

### 4.3 Variables de entorno

**API** (`apps/api/.env`):

Copiar `apps/api/.env.example` a `apps/api/.env` y completar:

| Variable                | Obligatorio | Descripción                                                    |
| ----------------------- | ----------- | -------------------------------------------------------------- |
| DATABASE_URL            | Sí          | `postgresql://user:pass@host:5432/matchprop`                   |
| JWT_SECRET              | Sí          | Clave secreta para JWT (generar con `openssl rand -base64 32`) |
| AUTH_REFRESH_SECRET     | Sí          | Clave para refresh tokens                                      |
| APP_URL                 | Sí          | URL pública de la app (ej. `https://app.matchprop.com`)        |
| API_PUBLIC_URL          | Sí          | URL pública de la API (ej. `https://api.matchprop.com`)        |
| CORS_ORIGINS            | Sí          | Orígenes permitidos, separados por coma                        |
| COOKIE_SECURE           | Sí          | `true` en producción (HTTPS)                                   |
| INTEGRATIONS_MASTER_KEY | Sí          | Clave para cifrado (Kiteprop)                                  |
| DEMO_MODE               | Sí          | `0` en producción                                              |
| STRIPE_SECRET_KEY       | No          | Para Premium B2C                                               |
| STRIPE_WEBHOOK_SECRET   | No          | Para webhook Stripe                                            |

**Web** (`apps/web/.env.local`):

```
NEXT_PUBLIC_API_URL=https://api.matchprop.com
API_SERVER_URL=https://api.matchprop.com
```

O si API y Web están en el mismo dominio con proxy, ajustar según arquitectura.

---

## 5. Migraciones

```bash
pnpm run deploy:pre
```

O manualmente:

```bash
pnpm --filter api exec prisma generate
pnpm --filter api exec prisma migrate deploy
```

---

## 6. Build

```bash
pnpm build
```

Orden: shared → api → web → admin.

---

## 7. Ejecución en producción

### API

```bash
pnpm --filter api start
```

Puerto por defecto: 3001 (variable `PORT`).

### Web

```bash
pnpm --filter web start
```

Puerto por defecto: 3000.

### Admin (opcional)

```bash
pnpm --filter admin start
```

Puerto: 3002.

---

## 8. Verificación previa al deploy

```bash
pnpm run pre-deploy:verify
```

Ejecuta: build shared, typecheck, build api/web/admin, tests API.

---

## 9. Healthcheck

`GET /health` devuelve:

- **200** si DB OK: `{ status: "ok", db: "ok" }`
- **503** si DB falla

Configurar en el load balancer o plataforma de deploy.

---

## 10. Documentos de referencia

| Documento                             | Uso                                        |
| ------------------------------------- | ------------------------------------------ |
| **README.md**                         | Visión general, scripts, estructura        |
| **INSTRUCCIONES.md**                  | Cómo probar localmente                     |
| **docs/PROD.md**                      | Checklist producción, variables, seguridad |
| **docs/REVISION_FINAL_PRE_DEPLOY.md** | Checklist a completar antes de cada deploy |
| **docs/masterplan.md**                | Especificación de producto                 |
| **docs/AUDITORIA_V1_DEPLOY.md**       | Estado de módulos v1.0                     |

---

## 11. Checklist mínimo para go-live

- [ ] PostgreSQL creado y accesible
- [ ] `apps/api/.env` configurado (DEMO_MODE=0, COOKIE_SECURE=true, CORS, JWT, etc.)
- [ ] `apps/web/.env.local` con API_SERVER_URL correcto
- [ ] Migraciones aplicadas
- [ ] Build exitoso
- [ ] Healthcheck respondiendo 200
- [ ] Login/registro funcional
- [ ] Webhook Stripe registrado (si usa Premium)

---

## 12. Contacto y soporte

Para dudas sobre la implementación, consultar la documentación en `docs/` y el código fuente.
