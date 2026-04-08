# Flujo de trabajo — una línea estable

Este documento define **qué mirar**, **qué ignorar** y **en qué orden** actuar. Evita mezclar fallos de código con fallos de base de datos o con jobs que no bloquean el merge.

---

## 1. Puerta única obligatoria (código)

En GitHub, la rama `main` exige el check **`CI / Verify`**.

Ese job corre en **cada PR** y en **cada push a `main`**. Si **Verify** está rojo, **no merge** hasta corregirlo.

**Qué incluye Verify (resumen):** typecheck, lint, `format:check` (Prettier), tests, migraciones contra Postgres de CI, builds de apps.

**Antes de pushear** (misma lógica que CI, sin Postgres local para migrate en un solo comando):

```bash
pnpm ci:verify
```

Si falla `format:check`:

```bash
pnpm format
```

Luego commit de los archivos que Prettier tocó.

---

## 2. Qué no es “el mismo error”

| Tema | Dónde se ve | Relación con Verify |
|------|-------------|---------------------|
| **Código / formato / tests** | `CI` → job **Verify** | **Sí:** bloquea merge si falla. |
| **Neon (Postgres de producción)** | Login roto, `smoke-prod.sh`, `/health` → `migration` vieja | **No** pasa por Verify. Es operación: `DATABASE_URL` + `prisma migrate deploy` (local o workflow **Migrate database (production)**). |
| **Vercel build** | Dashboard proyecto | Debe estar **Ready**; si Verify está verde, el problema suele ser deploy/config, no el mismo que lint. |

No confundir: **Verify verde** no garantiza **Neon al día**. Al revés: **Neon desfasado** puede romper login en prod con **Verify verde**.

---

## 3. Workflows de GitHub — mapa corto

| Workflow | Cuándo corre | ¿Bloquea el PR? |
|----------|----------------|-----------------|
| **CI** (`ci.yml`) | PR + push `main` | **Sí** — si ruleset pide `CI / Verify`. |
| **Deploy auto (PR + automerge)** | Push a ramas que no son `main` | No como “required check”; crea/actualiza PR. |
| **pr-automerge-label** | Eventos del PR | No sustituye a Verify. |
| **merge-after-ci** | Cuando CI termina | Ayuda al merge automático. |
| **Migrate database (production)** | Solo **manual** (`workflow_dispatch`) | No corre en PR. Usar para Neon prod + secret `DATABASE_URL_PROD`. |
| **Cron ingest**, **Smoke prod (schedule)**, **align-prod**, **prod-self-heal** | Cron o manual | **No** son la puerta de merge. Ruido normal si fallan por red/secret; no mezclar con Verify. |
| **vercel-deploy-hooks** / **vercel-prod-cli** | Manual | Rescate de deploy. |

Regla práctica: **si el PR no mergea, mirá solo `CI` → Verify**. El resto es secundario hasta que Verify esté verde.

---

## 4. Orden recomendado (día a día)

1. Rama desde `main` → cambios → **`pnpm ci:verify`** local.
2. Push → PR → esperar **`CI / Verify`** verde.
3. Merge (o automerge si está configurado).
4. **Después del merge:** Vercel despliega; opcional `bash scripts/verify-deploy-status.sh`.
5. **Solo si hay problema de login / esquema en prod:** flujo Neon (`docs/PROD.md`, scripts `scripts/prod-migrate*.sh`, workflow **Migrate database**), no re-ejecutar Verify al azar.

---

## 5. Dónde profundizar

- Deploy y bloqueos: [DEPLOY_TROUBLESHOOTING.md](./DEPLOY_TROUBLESHOOTING.md)
- Producción y migraciones: [PROD.md](./PROD.md)
- Variables y URLs: [ENV_REFERENCIA.md](./ENV_REFERENCIA.md), [CONEXIONES_VERCEL.md](./CONEXIONES_VERCEL.md)

---

## 6. Producción: qué podés probar “desde la web”

| URL | Qué esperar |
|-----|-------------|
| [match-prop-web.vercel.app](https://match-prop-web.vercel.app) | La home y el **login** suelen responder **200** (la app carga). |
| Login real / demo / feed | Requieren **API + Neon con migraciones al día**. Si `migration` en `/health` de la API va **varias carpetas atrás** respecto al repo, **sesión y demo fallan** hasta ejecutar `prisma migrate deploy` en prod (workflow **Migrate database (production)** o `scripts/prod-migrate-recover-neon.sh` + `prod-migrate.sh`). |

**Pruebas completas con sesión** mientras Neon se alinea: entorno **local** con `pnpm dev:up` (o `pnpm dev:web` + API) y Postgres local migrado — misma app, sin depender del esquema de prod.

---

## 7. Principio

**Un solo criterio de “listo para merge”: `CI / Verify` en verde.**  
Lo demás (Neon, hooks, cron) son **canales aparte** con sus propios comandos y secretos.
