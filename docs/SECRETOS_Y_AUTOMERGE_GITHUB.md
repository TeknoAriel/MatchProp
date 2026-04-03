# Secretos de GitHub (automerge, cron) y “Allow auto-merge”

Repo: **https://github.com/kiteprop/ia-matchprop**

Estos secretos **no los “descargás” de ningún lado**: los **creás vos** (un token o una clave) y los pegás en GitHub.

---

## 1. Dónde cargar los secretos (enlace directo)

**Secrets del repositorio → Actions:**

[https://github.com/kiteprop/ia-matchprop/settings/secrets/actions](https://github.com/kiteprop/ia-matchprop/settings/secrets/actions)

Clic en **New repository secret**. Nombre exacto (mayúsculas) y valor como abajo.

---

## 2. `AUTOMERGE_TOKEN` (opcional pero útil)

**Qué es:** un **Personal Access Token (PAT)** de GitHub con permiso para mergear PRs, guardado como secreto.

**No es obligatorio** si mergeás a mano o si el `GITHUB_TOKEN` del workflow alcanza para mergear (a veces no alcanza si `main` está muy protegido).

### Cómo crearlo (clásico, simple)

1. Abrí (con tu usuario que tenga permiso en `kiteprop/ia-matchprop`):  
   [https://github.com/settings/tokens](https://github.com/settings/tokens)
2. **Generate new token (classic)**.
3. Nombre: ej. `ia-matchprop-automerge`.
4. Expiration: la que quieras (90 días o más).
5. Marcá el scope **`repo`** (acceso completo a repos privados).
6. **Generate token** y **copiá** el valor (solo se muestra una vez).
7. En el repo: [Secrets → Actions](https://github.com/kiteprop/ia-matchprop/settings/secrets/actions) → **New repository secret**
   - **Name:** `AUTOMERGE_TOKEN`
   - **Secret:** pegá el token.

**Importante:** el usuario dueño del token debe ser **miembro del org** `kiteprop` con permiso de **write** o **maintain** en el repo para poder mergear.

---

## 3. `CRON_SECRET` (ingest programado)

**Qué es:** la **misma contraseña** que usa la API en producción para aceptar `POST /cron/ingest`.

1. En **Vercel** → proyecto de la **API** → **Settings → Environment Variables** buscá **`CRON_SECRET`** (o creala).
2. Generá un string largo aleatorio (ej. 32+ caracteres). **El mismo valor** debe estar:
   - en **Vercel** (`CRON_SECRET`), y
   - en GitHub: [Secrets → Actions](https://github.com/kiteprop/ia-matchprop/settings/secrets/actions) → nombre **`CRON_SECRET`**.

Si **no** cargás `CRON_SECRET` en GitHub, el workflow [cron-ingest.yml](../.github/workflows/cron-ingest.yml) **no llama** a la API (hace skip sin error).

---

## 4. `VERCEL_DEPLOY_HOOK_*` (opcional — redeploy desde Actions)

URLs de **Deploy Hooks** (Vercel → proyecto → Settings → Git → Deploy Hooks, rama Production). El workflow [vercel-deploy-hooks.yml](../.github/workflows/vercel-deploy-hooks.yml) hace `POST` **después de un CI verde en `main`** (o manual `workflow_dispatch`) si el secreto existe — no antes de **Verify**.

| Secreto en GitHub          | Proyecto típico |
| -------------------------- | --------------- |
| `VERCEL_DEPLOY_HOOK_API`   | API             |
| `VERCEL_DEPLOY_HOOK_WEB`   | Web             |
| `VERCEL_DEPLOY_HOOK_ADMIN` | Admin           |

Guía: **[CONECTAR_VERCEL_GITHUB.md](./CONECTAR_VERCEL_GITHUB.md)**.

---

## 5. Vercel CLI en producción (mismo patrón que Propieya)

Si la integración Git falla por _Git author / team_ (Hobby), configurá deploy por **token** como en `ia-propieya` (`promote-deploy-infra.yml`).

| Secreto en GitHub         | Origen                                                                                                                        |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `VERCEL_TOKEN`            | Vercel → [Account Settings → Tokens](https://vercel.com/account/tokens) → Create (scope que permita deploy al team/proyecto). |
| `VERCEL_ORG_ID`           | Vercel → Team → Settings → **Team ID**, o en `.vercel/project.json` tras `vercel link` local.                                 |
| `VERCEL_PROJECT_ID_API`   | Proyecto **match-prop-api-1jte** → Settings → General → **Project ID**.                                                       |
| `VERCEL_PROJECT_ID_WEB`   | Proyecto **match-prop-web** → Settings → General → **Project ID**.                                                            |
| `VERCEL_PROJECT_ID_ADMIN` | Proyecto **match-prop-admin** → Settings → General → **Project ID**.                                                          |

Podés definir solo los IDs que quieras desplegar por CLI; los vacíos se omiten. El workflow **[vercel-prod-cli.yml](../.github/workflows/vercel-prod-cli.yml)** valida que cada ID apunte al **nombre** de proyecto esperado (`scripts/matchprop-production-canonical.env.sh`).

---

## 6. `DEPLOY_WEBHOOK_URL` (opcional)

Solo si usás un webhook externo al terminar deploy. Si no, no hace falta crearlo.

---

## 7. Por qué no podés activar “Allow auto-merge”

Ese interruptor está acá (misma página de ajustes generales del repo):

[https://github.com/kiteprop/ia-matchprop/settings](https://github.com/kiteprop/ia-matchprop/settings)

Sección **Pull Requests** → **Allow auto-merge**.

**Si está gris o no aparece**, suele ser por:

| Causa                           | Qué hacer                                                                                                                                                                                                                                              |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Política de la organización** | Un owner del org `kiteprop` debe habilitarlo en org: [Organization settings → Member privileges](https://github.com/organizations/kiteprop/settings/member_privileges) (o **Policies**) y permitir auto-merge en repos.                                |
| **Sin permisos de admin**       | Necesitás rol **Admin** en el repo (o owner del org).                                                                                                                                                                                                  |
| **Merge deshabilitado**         | En [Branches](https://github.com/kiteprop/ia-matchprop/settings/branches) o en reglas del repo, tiene que existir al menos un método permitido: **merge commit**, **squash** o **rebase** (Settings → General → Pull Requests → Allow squash / merge). |

**Plan gratuito de GitHub:** auto-merge **sí existe** en repos públicos/privados estándar; si el org usa reglas estrictas, igual depende del owner.

**Alternativa sin auto-merge:** mergear a mano cuando el CI esté verde, o usar solo el workflow que mergea con `gh pr merge` + `AUTOMERGE_TOKEN`.

---

## 8. Permisos de Actions (necesario para bots)

[https://github.com/kiteprop/ia-matchprop/settings/actions](https://github.com/kiteprop/ia-matchprop/settings/actions)

- **Workflow permissions:** **Read and write** (si los workflows crean PRs o comentan).

---

## Resumen rápido

| Secreto                                                  | Origen del valor                                           | Obligatorio                               |
| -------------------------------------------------------- | ---------------------------------------------------------- | ----------------------------------------- |
| `AUTOMERGE_TOKEN`                                        | Lo generás en [tokens](https://github.com/settings/tokens) | No (recomendado si usás merge automático) |
| `CRON_SECRET`                                            | Mismo valor que `CRON_SECRET` en Vercel (API)              | No (sin él el cron no dispara ingest)     |
| `VERCEL_DEPLOY_HOOK_API` / `_WEB` / `_ADMIN`             | URLs de Deploy Hooks en Vercel                             | No                                        |
| `VERCEL_TOKEN` + `VERCEL_ORG_ID` + `VERCEL_PROJECT_ID_*` | Vercel CLI deploy (workflow `vercel-prod-cli.yml`)         | No                                        |
| `DEPLOY_WEBHOOK_URL`                                     | URL que te dé tu herramienta de avisos                     | No                                        |
