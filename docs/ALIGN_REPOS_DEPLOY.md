# Alineación repo ↔ deploy

Objetivo: **una sola comprobación** para saber si tu Git (local y remotos) y **producción** (Vercel, vía `GET /health` de la API) están alineados con **`origin/main`**.

## Comando principal

```bash
pnpm align:check
```

Equivalente:

```bash
bash scripts/align-repos-deploy.sh
```

### Qué hace

1. `git fetch origin main` (y `kiteprop main` si el remoto existe).
2. Muestra: rama actual, SHA de `HEAD`, `origin/main`, y si aplica `kiteprop/main` vs `origin/main`.
3. Si estás en **`main`**: comprueba que `HEAD` = `origin/main` (con contadores ahead/behind si no).
4. Ejecuta **`scripts/verify-deploy-status.sh main`**: producción (API + proxy web) debe exponer el mismo SHA que `origin/main` en `version`.

### Opciones

| Opción         | Uso                                                                                                |
| -------------- | -------------------------------------------------------------------------------------------------- |
| `--git-only`   | Solo pasos Git; no llama a la API (sin red o CI que no debe tocar prod).                           |
| `--sync-local` | Solo en rama `main`: ejecuta `scripts/sync-local-from-main.sh` (stash + pull) y vuelve a comparar. |
| `--no-fetch`   | No hace `fetch` (más rápido; puede mostrar refs desactualizadas).                                  |

### Códigos de salida

- **0**: Alineado según las reglas anteriores.
- **1**: Desalineación o error (local `main` ≠ `origin/main`, prod ≠ `main`, fetch fallido, etc.).

## Scripts relacionados

| Script                            | Rol                                                            |
| --------------------------------- | -------------------------------------------------------------- |
| `scripts/verify-deploy-status.sh` | Solo prod vs `main` (y merge de rama si pasás otra rama).      |
| `scripts/sync-local-from-main.sh` | Dejar tu `main` local igual que `origin/main`.                 |
| `scripts/git-remotes-tekno.sh`    | Configurar `origin` (Tekno) y opcional `kiteprop` (auditoría). |

## Flujo recomendado

1. Después de merge a `main`: `pnpm align:check` (esperar 2–5 min si Vercel aún despliega).
2. Si prod va bien pero tu `main` local está viejo: `bash scripts/sync-local-from-main.sh` o `pnpm align:check --sync-local`.
3. Cambios nuevos: push a **rama** + PR (no push directo a `main` si hay branch protection).

## Automático en GitHub Actions

El workflow **Align check (repo ↔ prod)** (`.github/workflows/align-prod.yml`) ejecuta el mismo script **los lunes** (UTC) y permite **`workflow_dispatch`** manual. Si falla, revisá merge pendiente, deploy de Vercel o `docs/DEPLOY_TROUBLESHOOTING.md`.

## Dos repos (Tekno vs Kiteprop)

- **Canónico de trabajo:** `origin` → `TeknoAriel/MatchProp`.
- **kiteprop:** copia opcional; si `kiteprop/main` ≠ `origin/main`, el script solo **avisa** (no falla). Sincronizar con `git push kiteprop main` cuando corresponda a política del equipo.
