# Repositorio oficial — `kiteprop/ia-matchprop`

El código fuente vive en: **https://github.com/kiteprop/ia-matchprop**  
Remote Git recomendado: `git@github.com:kiteprop/ia-matchprop.git`

El historial anterior puede vivir en otro remoto (p. ej. fork viejo); no hace falta para desplegar. **Vercel + CI** deben usar solo `kiteprop/ia-matchprop` — ver **[CONECTAR_VERCEL_GITHUB.md](./CONECTAR_VERCEL_GITHUB.md)**.

---

## 1. Git (local)

En tu máquina, el proyecto debería tener:

```bash
git remote -v
# origin    git@github.com:kiteprop/ia-matchprop.git
```

Si clonás desde cero:

```bash
git clone git@github.com:kiteprop/ia-matchprop.git
cd ia-matchprop
```

---

## 2. GitHub (organización `kiteprop`)

1. Abrí **https://github.com/kiteprop/ia-matchprop/settings**
2. **General → Default branch:** debe ser **`main`**.
3. **Actions → General:** “Workflow permissions” en **Read and write** si usás deploy automático y PRs.
4. **Secrets and variables → Actions:** volvé a crear secretos que dependían del repo viejo. Guía paso a paso: **[SECRETOS_Y_AUTOMERGE_GITHUB.md](./SECRETOS_Y_AUTOMERGE_GITHUB.md)** (incluye `AUTOMERGE_TOKEN`, `CRON_SECRET`, auto-merge).
5. **Branches → Branch protection rules** para `main`: alineá con [CONFIG_PARA_DEPLOY_AUTOMATICO.md](./CONFIG_PARA_DEPLOY_AUTOMATICO.md).

---

## 3. Vercel (manual — imprescindible si seguís desplegando desde Git)

Los proyectos en Vercel suelen seguir apuntando al **repositorio anterior**. Hay que reconectar cada app al repo nuevo.

### 3.1 Web (`match-prop-web` o equivalente)

1. **https://vercel.com** → tu equipo / proyecto de la Web.
2. **Settings → Git** → **Connected Git Repository** → **Disconnect** (si sigue el repo viejo).
3. **Connect Git Repository** → elegí **`kiteprop/ia-matchprop`** (autorizá la org si GitHub lo pide).
4. **Root Directory:** `apps/web`
5. **Production Branch:** `main`
6. Revisá **Environment Variables** (no deberían borrarse al reconectar, pero verificá):
   - `API_SERVER_URL` → URL pública de tu API (ej. `https://match-prop-admin-dsvv.vercel.app`)
   - `NEXT_PUBLIC_API_URL` → misma API si la usás en cliente
   - Cualquier otra del [SETUP_DEPLOY_SIMPLE.md](./SETUP_DEPLOY_SIMPLE.md)

### 3.2 API (`match-prop-api-1jte` o equivalente)

1. Mismo flujo: **Settings → Git** → conectar **`kiteprop/ia-matchprop`**.
2. **Root Directory:** `apps/api`
3. **Production Branch:** `main`
4. Variables: `DATABASE_URL`, `APP_URL`, `CORS_ORIGINS`, `COOKIE_SECURE`, etc. según [PROD.md](./PROD.md).

### 3.3 Admin (si aplica)

- **Root Directory:** `apps/admin`
- Misma org/repo `kiteprop/ia-matchprop`.

### 3.4 Scope Vercel (`teknoariels-projects`)

En la documentación vieja aparece el scope **`teknoariels-projects`**. Si el equipo de Kiteprop usa **otro team en Vercel**, reemplazá en tus comandos `vercel link`:

```bash
cd apps/web && vercel link --yes --scope TU_EQUIPO_VERCEL --project match-prop-web
```

Sustituí `TU_EQUIPO_VERCEL` por el slug que ves en la URL de Vercel (`vercel.com/<slug>/...`).

---

## 4. URLs públicas (referencia)

| Qué            | Ejemplo (ajustá a tu deploy real)          |
| -------------- | ------------------------------------------ |
| Web producción | `https://match-prop-web.vercel.app`        |
| API            | `https://match-prop-admin-dsvv.vercel.app` |
| Health         | `…/health` en la API                       |

Tras reconectar Vercel, dispará un deploy desde `main` y comprobá `bash scripts/verify-deploy-status.sh main`.

---

## 5. Checklist rápido

- [ ] `git push origin main` funciona con SSH o HTTPS.
- [ ] GitHub: default branch `main`, secretos de Actions.
- [ ] Vercel: Web + API (y Admin) enlazados a `kiteprop/ia-matchprop`.
- [ ] Variables de entorno en Vercel revisadas.
- [ ] CI verde en **https://github.com/kiteprop/ia-matchprop/actions**
