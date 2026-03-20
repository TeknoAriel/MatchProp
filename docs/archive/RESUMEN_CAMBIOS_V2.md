# MatchProp v2.0 — Resumen de Cambios

## Qué se conservó (tal cual)

- Feed / Swipes / Lista
- Asistente parser (texto → filtros)
- SavedSearch / Alertas
- Leads pending → active
- Kiteprop / delivery
- Ingest / demo data

## Qué se conservó con refactor mínimo

- Auth (magic link, passkey, JWT) — sin cambios
- Visitas — API y UI existentes
- Chat — API y UI existentes
- Stripe — rutas y UI existentes
- Admin — panel existente

## Qué se eliminó / congeló

- **Mobile scaffold**: Congelado. Añadido `apps/mobile/CONGELADO_V2.md`. Build excluye mobile (`pnpm -r --filter '!mobile' run build`).

## Archivos modificados

| Archivo                      | Cambio                              |
| ---------------------------- | ----------------------------------- |
| package.json                 | version 2.0.0; build excluye mobile |
| .env.example                 | Nuevo (raíz, variables mínimas)     |
| docs/SETUP_V2.md             | Nuevo                               |
| docs/GUIA_DEMO_V2.md         | Nuevo                               |
| docs/REPO_REMOTO_V2.md       | Nuevo                               |
| docs/RESUMEN_CAMBIOS_V2.md   | Este archivo                        |
| docs/INFORME_AUDITORIA_PM.md | Formateo Prettier                   |
| apps/mobile/CONGELADO_V2.md  | Nuevo                               |

## Evidencia técnica (post-Fase 0)

```
pnpm lint        → OK
pnpm format:check → OK
pnpm -r typecheck → OK (5 workspaces)
pnpm --filter api test:all → 131 tests OK
pnpm build       → OK (shared, api, web, admin)
pnpm audit:verify → Gates OK
```

## Flujo demo verificable

Ver `docs/GUIA_DEMO_V2.md`.

- Usuario crea/ajusta perfil
- Recibe propiedades relevantes (asistente, feed)
- Guarda / descarta / marca interés
- Lead pending → active
- Admin puede visualizar

## Comando único para demo

```bash
pnpm start
```
