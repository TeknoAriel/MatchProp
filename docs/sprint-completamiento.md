# Sprint de Completamiento — MatchProp

**Objetivo:** cerrar brechas documentadas y completar features pendientes de alto valor.

---

## Estado actual (pre-sprint)

| Ítem                       | Estado real en repo | Doc (gap-check) |
| -------------------------- | ------------------- | --------------- |
| Chat controlado + anti-PII | DONE                | NOT STARTED     |
| Agenda de visitas          | DONE                | NOT STARTED     |
| Kiteprop por etapas        | DONE                | PARTIAL         |
| Analytics (trackEvent)     | DONE                | NOT STARTED     |
| Reverse-matching           | DONE                | —               |
| Listas con nombre          | NOT STARTED         | —               |
| Feature flags / PROD       | PARTIAL             | PARTIAL         |

---

## Scope del sprint

### 1. Documentación (actualizar al estado real)

- [x] alignment-checklist: marcar Chat (7), Agenda (8) como DONE
- [x] alignment-checklist: marcar Kiteprop por etapas (6) DONE
- [x] alignment-checklist: marcar Analytics (15) DONE
- [x] gap-check: actualizar gaps funcionales

### 2. PROD y feature flags ✅

- [x] PROD.md: documentar "demo off en prod" (KITEPROP_EXTERNALSITE, API_PARTNER_1)
- [x] PROD.md: checklist pre-producción

### 3. Listas con nombre ✅

- [x] Modelo SavedList + SavedListItem
- [x] API: POST/GET /me/lists, POST /me/lists/:id/items, GET /me/lists/:id/items
- [x] UI: modal Agregar a lista → crear y agregar a lista con nombre; listas custom en Mis listas
- [x] Saved page: tabs para Favoritos, Ver después, listas custom

### 4. Deuda / estabilidad ✅

- [x] Smoke: validar flujo dashboard → feed (waitForURL acepta /dashboard o /feed)
- [x] Dashboard redirect cuando hay active search (ya implementado)
- [x] Responsive: header feed/list flex-col sm, ActiveSearchBar max-w responsive

---

## Gates

- `pnpm -r typecheck` verde
- `pnpm --filter api test:all` verde
- `pnpm smoke:ux` PASS
