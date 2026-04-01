# Sprint 9 — Web Push operativo + Mis match (SPEC)

**Objetivo:** mantener **Web Push** como canal de alertas y avanzar el **SPEC_BUSQUEDAS_Y_MATCH** sin duplicar trabajo ya hecho en `/searches` y `/alerts`.

**Duración sugerida:** 1–2 semanas (ajustar según capacidad).

---

## 1. Web Push (mantener y operar)

| Tarea | Estado | Notas |
|--------|--------|--------|
| Código en `main` (subscribe, `sw.js`, `sendAlertWebPush`, tabla Prisma) | Hecho | Sin VAPID el envío no rompe nada |
| Variables en API (Vercel / env): `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, opcional `VAPID_SUBJECT` | Pendiente ops | `npx web-push generate-vapid-keys` |
| Migración `WebPushSubscription` en DB de producción | Pendiente ops | `prisma migrate deploy` |
| Opcional: `NEXT_PUBLIC_VAPID_PUBLIC_KEY` en build web | Pendiente ops | Misma clave pública que la API |
| Deploy API alineado con `main` (`scripts/verify-deploy-status.sh`) | Pendiente ops | Si `/health` queda viejo, revisar proyecto Vercel API |

---

## 2. SPEC — Búsquedas / Mis match / Mis alertas

| # | Entrega (SPEC §7) | Estado Sprint 9 |
|---|-------------------|-----------------|
| 1 | Acciones en card de búsquedas | Mayormente en `/searches`; refinar si falta §1.1 |
| 2 | Menú alertas en card | Cubierto en listado `/searches` (subs + deliveries) |
| 3 | Resultado alertas por búsqueda en card | Cubierto vía `deliveries/by-search` |
| 4 | **Dashboard: botones Mis match y Mis alertas** | **Este sprint** |
| 5 | **`GET /me/match/feed` + UI “Descubrir”** | **Este sprint** (agregado multi-búsqueda, orden like > favorito > resto) |
| 6 | `SavedSearch.isActiveForMatch` + `PATCH /searches/:id` | Backlog (Sprint 10 o cuando prioricen exclusión por búsqueda) |
| 7 | Pulir `/alerts` (agrupación UX) | Backlog menor |

---

## 3. Definición técnica — `GET /me/match/feed`

- **Auth:** igual que otros `/me/*`.
- **Comportamiento:** todas las `SavedSearch` del usuario (más recientes primero, tope de búsquedas), por cada una `executeFeed` con filtros de la búsqueda; unión de listings **sin duplicar**; orden final: **me interesa (LATER) > favorito > resto**, y dentro de cada grupo por `lastSeenAt`/`createdAt` descendente.
- **Límites:** acotar búsquedas consultadas y listings devueltos para proteger la DB (valores por defecto en código).

---

## 4. Criterios de cierre Sprint 9

- [x] Usuario ve en **dashboard** accesos claros a **Mis match** y **Mis alertas**.
- [x] En **Mis match**, pestaña **Descubrir** muestra propiedades agregadas de sus búsquedas guardadas con el orden acordado.
- [x] Pestaña **Seguimiento** conserva el comportamiento actual (likes/favoritos).
- [ ] Push: checklist §1 aplicado en el entorno donde se pruebe producción.

---

## 5. Referencias

- [SPEC_BUSQUEDAS_Y_MATCH.md](./SPEC_BUSQUEDAS_Y_MATCH.md)
- [DEPLOY_TROUBLESHOOTING.md](./DEPLOY_TROUBLESHOOTING.md)
- `apps/api/src/lib/web-push-send.ts`, `apps/web/public/sw.js`
