# Sprint: Fase 2 (Chat/Agenda) + Fase 3 (Estabilidad y pre-prod)

**Objetivo:** Cerrar UI Chat y Agenda (E3/E4) y dejar documentación y smoke listos para pre-producción.

**Referencia:** [plan-completamiento-100.md](./plan-completamiento-100.md) — Fase 2 y Fase 3.

---

## Estado actual (pre-sprint)

- **Chat:** `/leads/[id]/chat` existe; GET/POST messages; solo permite uso si `lead.status === 'ACTIVE'`; mensaje "Activa el lead para chatear" si no.
- **Visitas:** `/leads/[id]/visits` existe; GET/POST visits; solo permite uso si `lead.status === 'ACTIVE'`; mensaje "Activá el lead para agendar visitas" si no.
- **Enlaces:** En `/leads` los botones "Chat" y "Agendar visita" solo se muestran cuando `lead.status === 'ACTIVE'`.
- **Smoke:** Ya cubre login → assistant → guardar búsqueda → searches → alerts → demo (chat/visits) → feed/list → leads → chat (enviar mensaje bloqueado) → visits (agendar).
- **PROD.md:** Ya tiene "Checklist pre-deploy", "Demo sources OFF", "Feature flags" y variables de entorno.

---

## Fase 2 — Cierre UI Chat y Agenda

### 2.1 Verificar Chat solo para lead ACTIVE

- [x] **2.1.1** Con lead PENDING/CLOSED, al abrir `/leads/:id/chat` se muestra "Activa el lead para chatear" y no el formulario. **En código:** `lead.status !== 'ACTIVE'` → mensaje + link Volver (líneas 87–100).
- [x] **2.1.2** La API `POST /leads/:id/messages` devuelve 403 con mensaje "Activá el lead para chatear" si el lead no es ACTIVE. **Ya implementado:** `apps/api/src/routes/leads.ts` líneas 339–341.
- **Evidencia:** `apps/web/src/app/leads/[id]/chat/page.tsx` (líneas 87–100).

### 2.2 Verificar Visitas solo para lead ACTIVE

- [x] **2.2.1** Con lead PENDING/CLOSED, al abrir `/leads/:id/visits` se muestra "Activá el lead para agendar visitas" y no el formulario. **En código:** `lead.status !== 'ACTIVE'` → mensaje + link Volver (líneas 109–119).
- [x] **2.2.2** La API `POST /leads/:id/visits` y `GET /leads/:id/visits` devuelven 403 con mensaje "Activá el lead para agendar visitas" si el lead no es ACTIVE. **Ya implementado:** `apps/api/src/routes/leads.ts` líneas 389–390 y 427–428.
- **Evidencia:** `apps/web/src/app/leads/[id]/visits/page.tsx` (líneas 109–119).

### 2.3 Enlaces desde lista de leads

- [x] **2.3.1** En `/leads`, los links "Chat" y "Agendar visita" solo se muestran cuando `lead.status === 'ACTIVE'`.
- **Evidencia:** `apps/web/src/app/leads/page.tsx` (279–296).

### 2.4 Smoke: Chat y Visitas

- [x] **2.4.1** Smoke actual ya incluye: click a chat, mensaje con email → bloqueado; click a visits, datetime-local + Agendar.
- [ ] **2.4.2** (Opcional) Añadir un test dedicado `smoke: chat y visits con lead ACTIVE` que solo abra chat y visits y verifique título/placeholder sin depender del demo 1-click.

### 2.5 UX menor (opcional)

- [x] **2.5.1** En `/leads/[id]/chat` y `/leads/[id]/visits`, breadcrumb "Consultas › Chat" / "Consultas › Agenda" añadido.
- [x] **2.5.2** En chat: si el backend devuelve 403 al enviar mensaje con lead no ACTIVE, mostrar mensaje "Activá el lead para chatear" en lugar de error genérico.

**Entregable Fase 2:** Checklist 2.1–2.3 verificado; 2.4 smoke OK; opcional 2.5.

---

## Fase 3 — Estabilidad y pre-producción

### 3.1 PROD.md: Checklist pre-producción y Demo OFF

- [x] **3.1.1** PROD.md ya tiene "Checklist pre-deploy" con DEMO_MODE=0, COOKIE_SECURE, CORS, JWT, DB, migraciones, "Demo sources OFF".
- [ ] **3.1.2** Añadir subsección explícita **"Demo sources OFF en prod"** con lista: DEMO_MODE=0, KITEPROP_EXTERNALSITE_MODE ≠ fixture, API_PARTNER_1 desactivado, DEMO_LISTINGS_COUNT no usado (o 0).
- **Archivo:** `docs/PROD.md` (o `apps/api/PROD.md` si se mantiene ahí).

### 3.2 Feature flags documentados

- [x] **3.2.1** PROD.md ya tiene tabla "Feature flags (Sprint 9)" con demoMode, stripePremium, kitepropExternalsite, apiPartner1 y valores en prod.
- [ ] **3.2.2** Indicar en PROD.md dónde se leen los flags (env vars; archivo `config` si existe) para que cualquier dev sepa cómo desactivar en prod.

### 3.3 Smoke: flujo búsqueda activa → feed

- [ ] **3.3.1** Añadir paso en el smoke principal (o test aparte): después de "Ver resultados ahora" en assistant, navegar a `/feed` o `/feed/list` y verificar que se ven resultados (o empty state coherente) **con la búsqueda activa aplicada** (p. ej. texto "Cambiar" o filtros visibles).
- **Archivo:** `apps/web/e2e/smoke-ux.spec.ts`.
- **Criterio:** Al menos un `expect` que confirme que el feed/list refleja la búsqueda (cards o "No hay resultados" / "Sin búsqueda activa").

### 3.4 Responsive mínimo

- [ ] **3.4.1** Revisar en viewport 320px y 375px: `/feed` (header, botón Modo Lista), `/feed/list` (ActiveSearchBar o selector de búsqueda), `/assistant` (textarea y botones).
- [ ] **3.4.2** Documentar en `docs/revision-responsive-sprint-siguiente.md` (o nuevo `docs/responsive-checklist.md`) los puntos revisados y cualquier ajuste (clases Tailwind, overflow, tap targets).
- **Criterio:** Sin overflow horizontal; botones/links utilizables; sin regresiones en desktop.

### 3.5 Healthcheck y errores críticos en smoke

- [x] **3.5.1** Smoke ya filtra errores benignos (ChunkLoadError, ResizeObserver, 401, key prop) y falla si hay errores críticos de runtime.
- [x] **3.5.2** Test `/status` ya verifica API OK y LISTINGS COUNT.

**Entregable Fase 3:** PROD.md con "Demo sources OFF" explícito y referencia a flags; smoke con paso feed con búsqueda activa; checklist responsive en [docs/responsive-checklist.md](./responsive-checklist.md). Revisión manual 320/375px (3.4.1) queda como tarea de QA.

---

## Orden sugerido de ejecución

1. **Fase 2:** 2.1.1, 2.1.2, 2.2.1, 2.2.2 (verificación manual o test); 2.4.2 si se desea test dedicado; 2.5 opcional.
2. **Fase 3:** 3.1.2 → 3.2.2 → 3.3.1 → 3.4.1 + 3.4.2.

---

## Resumen de tareas concretas (checklist)

| ID    | Tarea                                                  | Responsable | Estado |
| ----- | ------------------------------------------------------ | ----------- | ------ |
| 2.1.1 | Chat: mensaje "Activa el lead" cuando lead no ACTIVE   | —           | [x]    |
| 2.1.2 | API messages: 403 si lead no ACTIVE                    | —           | [x]    |
| 2.2.1 | Visits: mensaje "Activá el lead" cuando lead no ACTIVE | —           | [x]    |
| 2.2.2 | API visits: 403 si lead no ACTIVE                      | —           | [x]    |
| 2.3.1 | Links Chat/Visitas solo para ACTIVE en /leads          | —           | [x]    |
| 2.4.2 | (Opcional) Test smoke dedicado chat+visits             | Dev         | [ ]    |
| 2.5.1 | (Opcional) Breadcrumb Chat/Agenda                      | Dev         | [x]    |
| 2.5.2 | (Opcional) Mensaje claro en chat si 403                | Dev         | [x]    |
| 3.1.2 | PROD.md: subsección "Demo sources OFF en prod"         | Dev         | [x]    |
| 3.2.2 | PROD.md: dónde se leen los feature flags               | Dev         | [x]    |
| 3.3.1 | Smoke: paso feed/list con búsqueda activa              | Dev         | [x]    |
| 3.4.1 | Revisión responsive 320px / 375px                      | Dev         | [ ]    |
| 3.4.2 | Doc responsive checklist                               | Dev         | [x]    |

---

_Sprint creado a partir de plan-completamiento-100.md. **Fase 2 y Fase 3 cerradas.** Ejecutado: 2.1.1, 2.1.2, 2.2.1, 2.2.2, 2.5.1, 2.5.2, 3.1.2, 3.2.2, 3.3.1, 3.4.2. Pendiente solo: 2.4.2 (test dedicado chat+visits, opcional), 3.4.1 (revisión manual responsive con responsive-checklist.md)._
