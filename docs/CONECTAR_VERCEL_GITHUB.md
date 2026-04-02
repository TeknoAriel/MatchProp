# Conectar GitHub (`kiteprop/ia-matchprop`) con Vercel y dejar producción alineada

**Repo canónico:** `git@github.com:kiteprop/ia-matchprop.git` — rama de producción **`main`**.

Sin esto, Vercel puede seguir desplegando un commit viejo (p. ej. `/health.version` y `/version` en web distintos de `git rev-parse origin/main`).

---

## 1. En cada proyecto Vercel (Web, API, Admin)

Para **match-prop-web**, **match-prop-api-1jte** (API), **match-prop-admin** (si aplica):

1. [Vercel Dashboard](https://vercel.com) → proyecto → **Settings** → **Git**.
2. Si el repo conectado **no** es `kiteprop/ia-matchprop`: **Disconnect** y luego **Connect Git Repository**.
3. Elegí **`kiteprop/ia-matchprop`** (autorizá la organización en GitHub si pide permisos).
4. **Production Branch:** `main`.
5. **Root Directory** (crítico en monorepo):

| Proyecto Vercel (típico) | Root Directory |
| ------------------------ | -------------- |
| Web                      | `apps/web`     |
| API                      | `apps/api`     |
| Admin                    | `apps/admin`   |

6. Guardá. En **Deployments** debería aparecer un nuevo build por el último push a `main`.

Detalle de variables y _Ignored Build Step_: **[VERCEL_CONFIG.md](./VERCEL_CONFIG.md)** y **[SETUP_DEPLOY_SIMPLE.md](./SETUP_DEPLOY_SIMPLE.md)**.

---

## 2. Comprobar alineación (local)

```bash
git fetch origin main
bash scripts/verify-deploy-status.sh main
```

Cuando prod está al día, verás: **Producción está en el commit de main**.

---

## 3. Opcional: Deploy Hooks desde GitHub Actions

Si la integración Git → Vercel falla o querés forzar un redeploy tras CI:

1. Vercel → proyecto → **Settings** → **Git** → **Deploy Hooks** → crear hook para **Production** (uno por proyecto).
2. En GitHub → **kiteprop/ia-matchprop** → **Settings** → **Secrets and variables** → **Actions** → crear secretos:

| Secreto (ejemplo)          | Contenido                         |
| -------------------------- | --------------------------------- |
| `VERCEL_DEPLOY_HOOK_API`   | URL del hook del proyecto API     |
| `VERCEL_DEPLOY_HOOK_WEB`   | URL del hook del proyecto Web     |
| `VERCEL_DEPLOY_HOOK_ADMIN` | URL del hook del Admin (opcional) |

3. En el repo ya existe el workflow **Vercel deploy hooks** (`.github/workflows/vercel-deploy-hooks.yml`): en cada push a `main` hará `POST` a los hooks que estén definidos.

Si los secretos no existen, el workflow no hace nada y sigue en verde.

---

## 4. CLI (desarrollo)

```bash
npm i -g vercel
vercel login
cd apps/api && vercel link
cd apps/web && vercel link
# En el equipo Kiteprop, usar el scope correcto: vercel.com/<tu-team>/...
```

Tras `vercel link`, podés usar **`vercel git connect`** para enlazar el remoto local al proyecto.

---

## Referencias

- [REPO_OFICIAL_KITEPROP.md](./REPO_OFICIAL_KITEPROP.md) — remotes y secretos GitHub.
- [DEPLOY_TROUBLESHOOTING.md](./DEPLOY_TROUBLESHOOTING.md) — builds en rojo, reglas de rama, demoras.
