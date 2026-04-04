# Repositorio Git: Tekno (trabajo) y Kiteprop (auditoría)

## Flujo actual (sin depender del owner de Kiteprop)

| Rol                   | Remote     | URL típica                                 |
| --------------------- | ---------- | ------------------------------------------ |
| **Trabajo y CI**      | `origin`   | `git@github.com:TeknoAriel/MatchProp.git`  |
| **Copia / auditoría** | `kiteprop` | `git@github.com:kiteprop/ia-matchprop.git` |

- **Push diario:** `git push origin main` (y ramas de feature contra `origin`).
- **Vercel + GitHub Actions** deben apuntar al repo **`TeknoAriel/MatchProp`** (el que administrás).
- **Subir copia a Kiteprop** solo cuando haga falta auditoría: `git push kiteprop main` (u otra rama).

Configuración local en un solo paso:

```bash
bash scripts/git-remotes-tekno.sh
git remote -v
```

Repo público: [github.com/TeknoAriel/MatchProp](https://github.com/TeknoAriel/MatchProp) (mismo que Vercel suele tener conectado).

**Vercel:** en cada proyecto (Web, API, Admin) → **Settings → Git** → conectar **`TeknoAriel/MatchProp`**, rama **`main`**, mismos root (`apps/web`, `apps/api`, `apps/admin`). Detalle: **[CONECTAR_VERCEL_GITHUB.md](./CONECTAR_VERCEL_GITHUB.md)**.

Los secretos de Actions (`AUTOMERGE_TOKEN`, `CRON_SECRET`, `VERCEL_DEPLOY_HOOK_*`, etc.) van en el repo **donde corre CI** (hoy: **Tekno**). El org `kiteprop` puede quedar solo como espejo hasta que te habiliten acceso.

---

## 1. Git (local)

```bash
git remote -v
# origin    git@github.com:TeknoAriel/MatchProp.git
# kiteprop  git@github.com:kiteprop/ia-matchprop.git
```

Clonar desde Tekno:

```bash
git clone git@github.com:TeknoAriel/MatchProp.git
cd MatchProp
bash scripts/git-remotes-tekno.sh   # añade kiteprop si hace falta
```

---

## 2. GitHub — repo Tekno (`TeknoAriel/MatchProp`)

1. **https://github.com/TeknoAriel/MatchProp/settings** (ajustá si el usuario/repo difiere).
2. **Default branch:** `main`.
3. **Actions → Workflow permissions:** Read and write si usás deploy automático y PRs.
4. **Secrets:** [SECRETOS_Y_AUTOMERGE_GITHUB.md](./SECRETOS_Y_AUTOMERGE_GITHUB.md) — usar las mismas claves; las URLs del doc que apunten a `kiteprop` sustituilas mentalmente por el repo Tekno donde cargues los secretos.

---

## 3. GitHub — org `kiteprop` (solo copia)

Cuando el owner habilite acceso o para auditoría puntual:

- `git push kiteprop main`
- Secretos y branch protection en **kiteprop/ia-matchprop** solo si volvés a usar ese repo como canónico.

---

## 4. Vercel

Mismo equipo/proyectos (`teknoariels-projects`, `match-prop-web`, etc.), pero **Git conectado a `TeknoAriel/MatchProp`**, no al repo del org Kiteprop.

```bash
cd apps/web && vercel link --yes --scope teknoariels-projects --project match-prop-web
```

Más pasos: secciones 3.x de la versión anterior de este doc y **[CONECTAR_VERCEL_GITHUB.md](./CONECTAR_VERCEL_GITHUB.md)**.

---

## 5. URLs públicas (referencia)

| Qué            | Ejemplo (ajustá a tu deploy real)          |
| -------------- | ------------------------------------------ |
| Web producción | `https://match-prop-web.vercel.app`        |
| API            | `https://match-prop-admin-dsvv.vercel.app` |
| Health         | `…/health` en la API                       |

Tras reconectar Vercel al repo Tekno, comprobá `bash scripts/verify-deploy-status.sh main`.

---

## 6. Checklist rápido

- [ ] `git push origin main` → repo Tekno.
- [ ] GitHub (Tekno): secretos de Actions para CI y deploy.
- [ ] Vercel: Web + API (+ Admin) enlazados a **`TeknoAriel/MatchProp`**.
- [ ] CI verde en **https://github.com/TeknoAriel/MatchProp/actions** (ajustá URL si el repo difiere).
