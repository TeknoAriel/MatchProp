# Complemento de Evidencia — Auditoría MatchProp v1.0

**Adenda técnica verificable para decisión v2.0**  
**Fecha:** 21 de febrero de 2026

---

## 1. Estado exacto del repo

| Campo                 | Valor                                          |
| --------------------- | ---------------------------------------------- |
| **Repositorio git**   | NO — directorio no es un repo git (sin `.git`) |
| **Branch actual**     | N/A                                            |
| **Commit actual**     | N/A                                            |
| **Git status**        | N/A                                            |
| **Últimos 5 commits** | N/A                                            |

---

## 2. Verificación ejecutada

### pnpm lint

```
> matchprop@1.0.0 lint /Users/arielcarnevali/MatchProp
> eslint "apps/**/*.{ts,tsx}" "packages/**/*.{ts,tsx}"

(exit 0)
```

### pnpm format:check

```
> prettier --check "**/*.{ts,tsx,js,jsx,json,md}"

Checking formatting...
[warn] docs/INFORME_AUDITORIA_PM.md
[warn] Code style issues found in the above file. Run Prettier with --write to fix.
ELIFECYCLE  Command failed with exit code 1.
```

**Resultado:** FALLA (1 archivo sin formatear).

### pnpm -r typecheck

```
Scope: 5 of 6 workspace projects
packages/shared typecheck: Done
apps/admin typecheck: Done
apps/api typecheck: Done
apps/mobile typecheck: Done
apps/web typecheck: Done
```

**Resultado:** OK.

### pnpm --filter api test:all

```
Test Files  20 passed (20)
     Tests  131 passed (131)
```

**Resultado:** OK (sesión anterior de auditoría).

### build web

```
pnpm --filter web build → exit 0
Rutas: /feed, /feed/list, /assistant, /searches, /leads, /me/saved, /me/premium, /listing/[id], etc.
```

**Resultado:** OK.

### build api

```
> api@1.0.0 build
> tsc
(exit 0)
```

**Resultado:** OK.

### build admin

```
pnpm --filter admin build → exit 0
Rutas: /, /crm-push, /listings/[id]/matches, /match-events, /visits
```

**Resultado:** OK.

### audit:verify

```
=== audit:verify ===
pnpm lint       → OK
pnpm format:check → FALLA (docs/INFORME_AUDITORIA_PM.md)
(posterior: typecheck OK, test:all OK)
```

**Resultado:** FALLA por format:check. Resto OK.

---

## 3. Matriz de verificación funcional

| Flujo                         | Resultado | Evidencia                                                                                  |
| ----------------------------- | --------- | ------------------------------------------------------------------------------------------ |
| onboarding/comprador          | OK        | auth-magic.int.test (magic link), api.test (login), smoke-ux.spec.ts (login→assistant)     |
| feed/listado                  | OK        | feed.int.test, api.test GET /feed, POST /swipes                                            |
| ficha propiedad               | OK        | api.test GET /listings, apps/web/src/app/listing/[id]/page.tsx                             |
| guardar / descartar / interés | OK        | api.test swipe, feed.int.test exclusión post-swipe                                         |
| saved searches                | OK        | searches.int.test POST /searches, POST /assistant/search, POST /assistant/preview          |
| alertas                       | OK        | alerts.int.test POST /alerts/subscriptions, runAlerts                                      |
| lead pending                  | OK        | leads.int.test POST /leads, GET /me/leads                                                  |
| lead active                   | OK        | leads.int.test activate, mock Kiteprop delivery                                            |
| visitas                       | PARCIAL   | apps/api/src/routes/leads.ts POST/GET /leads/:id/visits, GET /me/visits. Sin test int.     |
| chat                          | PARCIAL   | apps/api/src/routes/leads.ts POST /leads/:id/messages. smoke-ux valida link. Sin test int. |
| premium/stripe                | PARCIAL   | apps/api/src/routes/stripe.ts. Requiere STRIPE\_\*. Sin test int.                          |
| admin leads                   | PARCIAL   | Admin app /leads. Sin test E2E admin. API cubierta por leads.int.test.                     |
| admin match-events            | PARCIAL   | crm-push.int.test, listing-matches-filters.int.test. Admin UI sin test.                    |
| admin crm-push                | OK        | crm-push.int.test, GET /admin/debug/crm-push                                               |

---

## 4. Clasificación para MatchProp v2.0

| Módulo                         | Conservar tal cual | Conservar con refactor | Conviene eliminar | Motivo                                               |
| ------------------------------ | ------------------ | ---------------------- | ----------------- | ---------------------------------------------------- |
| Auth (magic, passkey, JWT)     |                    | ✓                      |                   | Estable; considerar simplificar passkey si no se usa |
| Feed / Swipes / Lista          | ✓                  |                        |                   | Core validado por tests                              |
| Asistente (parser)             | ✓                  |                        |                   | search-parser.test, searches.int.test                |
| SavedSearch / Alertas          | ✓                  |                        |                   | alerts.int.test, alerts-runner                       |
| Leads (PENDING→ACTIVE)         | ✓                  |                        |                   | leads.int.test                                       |
| Visitas                        |                    | ✓                      |                   | API OK; falta test int                               |
| Chat                           |                    | ✓                      |                   | API OK; falta test int; revisar UX                   |
| Stripe Premium                 |                    | ✓                      |                   | Funcional; sin test; depende de env                  |
| Kiteprop / delivery            | ✓                  |                        |                   | delivery.int.test, integrations.int.test             |
| Admin (crm-push, match-events) |                    | ✓                      |                   | Backend testeado; Admin UI sin E2E                   |
| Ingest / demo:data             | ✓                  |                        |                   | ingest.int.test                                      |
| Mobile (scaffold)              |                    |                        | ✓                 | Scaffold vacío; evaluar si v2 lo usa                 |

---

## 5. Riesgos de release

### Bloqueantes para demo seria

- Ninguno detectado si Docker + DB están levantados.
- smoke:ux no ejecutado en esta sesión (requiere servidores y Playwright).

### Bloqueantes para producción

- DEMO_MODE=0 obligatorio.
- DATABASE_URL, JWT_SECRET, COOKIE_SECRET, CORS correctos.
- STRIPE\_\* si se usa Premium B2C.
- format:check debe pasar (arreglar docs/INFORME_AUDITORIA_PM.md o excluirlo).

### Deuda técnica que puede esperar

- Test int para visitas y chat.
- Test int para Stripe (mock).
- E2E para Admin.
- Deprecación punycode (Node).
- Fastify json shorthand schema en /listings/share.

---

## 6. Recomendación final

**Continuar sobre esta base.**

Motivo: API estable (131 tests), builds OK, flujos core cubiertos. La deuda es acotada (visitas, chat, Stripe sin tests; format:check) y no justifica refactor fuerte ni reset.
