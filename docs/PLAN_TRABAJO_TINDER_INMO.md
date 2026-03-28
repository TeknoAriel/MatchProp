# Plan de trabajo — Experiencia tipo Tinder (discovery inmobiliario)

Plan operativo para ejecutar las mejoras definidas en [`TINDER_INMO_AUDITORIA_Y_ROADMAP.md`](./TINDER_INMO_AUDITORIA_Y_ROADMAP.md).

**Convenciones**

- **Sprint:** ~2 semanas (ajustar según capacidad del equipo).
- **Hito (milestone):** entrega demostrable en producción o flaggable.
- **DoD (Definition of Done):** tests/E2E donde aplique, typecheck verde, sin regresiones críticas en smoke.

---

## Hitos de producto (macro)

| Hito | Nombre | Resultado observable |
|------|--------|----------------------|
| **M1** | Deck creíble | Usuario percibe mazo + flujo continuo sin sentir portal en la pantalla principal. |
| **M2** | Decisiones confiables | Rewind y likes/nopes coherentes con el servidor; sin sorpresas al refrescar. |
| **M3** | Interés fuerte | Super Like (o equivalente) con reglas y presencia en “Mis match”. |
| **M4** | Discovery inteligente | Orden del deck influenciado por afinidad + búsqueda activa. |
| **M5** | Post-match guiado | Tras Like/Super, siguiente paso claro sin obligar ficha completa. |

---

## Mapa de sprints → hitos

```
Sprint 1 ──► M1 (parcial)
Sprint 2 ──► M1 + M2 (parcial)
Sprint 3 ──► M2 (cierre) + M5 (parcial)
Sprint 4 ──► M3 + M4 (parcial)
Sprint 5 ──► M4 (cierre) + pulido y métricas
```

---

## Sprint 1 — Percepción “mazo” y menos portal en `/feed`

**Objetivo:** que la pantalla principal se sienta como app de descubrimiento, no como índice.

### Tareas

| ID | Tarea | Entregable | Criterio de aceptación |
|----|--------|------------|-------------------------|
| S1-1 | Stack visual 2 niveles | UI en `/feed` | Siguiente card visible detrás (offset/escala/sombra); la superior sigue siendo interactiva. |
| S1-2 | Reducir chrome del deck | `feed/page.tsx` + layout | Modo “foco”: minimizar links repetidos o moverlos a menú/ícono; barra de búsqueda no compite con altura del card. |
| S1-3 | Copy alineado a realidad | Textos toasts/celebración | No usar “match” por contador de likes; usar “Te gustó”, “Guardado en Mis intereses”, etc. |
| S1-4 | Accesibilidad | Botones | Mantener ≥48px táctil; foco teclado en acciones principales. |
| S1-5 | E2E smoke | `e2e/` | Test: `/feed` muestra stack o card y botones Nope/Like sin error. |

**DoD sprint 1:** build web OK; smoke E2E verde en CI; screenshot o Loom opcional para revisión UX.

**Riesgo:** regresión en `feed/list` → no tocar listado salvo imports compartidos.

---

## Sprint 2 — Rewind real + consistencia servidor

**Objetivo:** deshacer última decisión de forma **persistente** y predecible.

### Tareas

| ID | Tarea | Entregable | Criterio de aceptación |
|----|--------|------------|-------------------------|
| S2-1 | API revertir swipe | `DELETE /swipes/:listingId` o `POST /swipes/undo` | Elimina o invalida `SwipeDecision` del usuario para ese listing; documentado en OpenAPI/schema Fastify. |
| S2-2 | Feed incluye de nuevo el listing | `feed-engine` / queries | Tras revertir, el listing puede volver a aparecer (mismas reglas que un listing nunca visto). |
| S2-3 | UI Undo llama API | `feed/page.tsx` | “Deshacer último” invoca backend y solo entonces restaura cola; manejo de error con toast. |
| S2-4 | Ventana temporal (opcional) | Config / constante | Solo permitir undo de los últimos N segundos o 1 acción (evitar abuso). |
| S2-5 | Tests API | Vitest integración | Caso: swipe NOPE → undo → feed incluye listing. |

**DoD sprint 2:** tests API verdes; undo verificado manual en staging.

**Dependencia:** S1 estable (menos cambios paralelos en misma pantalla).

---

## Sprint 3 — Post-Like / capa de detalle sin fuga a portal

**Objetivo:** **M5** parcial — después de Like, CTAs claros sin obligar `/listing` inmediato.

### Tareas

| ID | Tarea | Entregable | Criterio de aceptación |
|----|--------|------------|-------------------------|
| S3-1 | Bottom sheet post-Like | Componente + estado | Tras Like exitoso, sheet con: Favorito, Consultar, Ver ficha completa (link). |
| S3-2 | “Continuar” explícito | UX | Cerrar sheet y pasar a siguiente card sin doble tap confuso. |
| S3-3 | Integración `InquiryModal` | Desde sheet | Abrir consulta con `source=FEED` coherente con analytics. |
| S3-4 | Tap en card | Comportamiento | Primer tap: sheet resumen **o** segunda foto; segundo tap / CTA: ficha (definir regla única y documentarla). |
| S3-5 | E2E flujo corto | e2e | Like → sheet visible → cerrar → siguiente card. |

**DoD sprint 3:** flujo móvil usable; sin regresión en `InquiryModal`.

---

## Sprint 4 — Super Like + afinidad en deck

**Objetivo:** **M3** y arranque de **M4**.

### Tareas

| ID | Tarea | Entregable | Criterio de aceptación |
|----|--------|------------|-------------------------|
| S4-1 | Modelo datos Super Like | Prisma + migración | Tabla o campo que permita cupo diario y consulta por usuario/listing. |
| S4-2 | API `POST /swipes/super` o extensión | Backend | Idempotente; descuenta cupo; visible en estado del listing para el usuario. |
| S4-3 | UI botón Super | `/feed` | Distinto de favorito; feedback visual; deshabilitado si sin cupo. |
| S4-4 | Afinidad en batch del feed | `executeFeed` o capa | Reordenar top-N del batch usando pesos (favoritos + likes + búsqueda activa opcional). |
| S4-5 | “Mis match” badge | `me/match` o card | Indicar Super Like vs Like simple. |

**DoD sprint 4:** migración aplicada en entornos; feature flag opcional para Super Like.

**Dependencia:** S2 (swipes consistentes) recomendable antes de sumar más tipos de decisión.

---

## Sprint 5 — Cierre M4/M5, modo Explorar vs Buscar, métricas

**Objetivo:** consolidar y medir.

### Tareas

| ID | Tarea | Entregable | Criterio de aceptación |
|----|--------|------------|-------------------------|
| S5-1 | Modo Explorar / Buscar | Navegación o toggle | Copy y entrada claras; lista como “Inventario” secundario. |
| S5-2 | Afinidad tunable | Config ligera | Pesos o límites documentados; no degradar latencia del feed. |
| S5-3 | Eventos analytics | Frontend/backend | `deck_swipe`, `deck_undo`, `super_like`, `post_like_sheet_cta`. |
| S5-4 | Fatiga | UX copy | Empty states y “pausa” cuando cola vacía; link a asistente/búsqueda. |
| S5-5 | Revisión documentación | `TINDER_INMO_*` | Actualizar roadmap con lo implementado y decisiones tomadas. |

**DoD sprint 5:** dashboard o logs revisables; documentación al día.

---

## Backlog (post M5)

- Ocultar listing 7 días / “no me interesa este estilo”.
- Lado publicante: “respondió tu consulta” como evento tipo match.
- Notificaciones push/email alineadas a Super Like y alertas.
- A/B tests en copy y orden de CTAs del sheet.

---

## Roles sugeridos (sin asignar nombres)

| Rol | Enfoque principal en sprints 1–3 |
|-----|----------------------------------|
| Frontend | `/feed`, `SwipeCard`, sheet, animaciones |
| Backend | swipes undo, super like, feed order |
| QA / Automatización | E2E smoke deck + API tests |
| Producto | copy, hitos, revisión acceptance |

---

## Checklist rápido al cerrar cada sprint

- [ ] `pnpm -r run typecheck`
- [ ] Tests afectados en verde
- [ ] Smoke E2E CI
- [ ] Cambios sensibles detrás de flag si hace falta
- [ ] Actualizar este plan (tachar tareas / mover a hecho)

---

*Última actualización: alineado al estado del repo y a `TINDER_INMO_AUDITORIA_Y_ROADMAP.md`.*
