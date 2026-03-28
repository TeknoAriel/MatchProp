# MatchProp × Tinder inmobiliario — Auditoría, gaps y roadmap

Documento vivo: define la promesa de producto, el estado real del código y un plan por etapas para acercar la **experiencia de descubrimiento** al modelo Tinder sin traicionar la lógica comercial inmobiliaria.

---

## 1. Resumen ejecutivo

**Hoy:** MatchProp tiene **un solo card visible** en `/feed`, botones Nope / Like / Favorito / Lista, **swipe persistido** en backend (`SwipeDecision`), exclusión de ya vistos en el feed, y un **listado clásico** en `/feed/list`. Eso es una base, pero **no se percibe como “Tinder serio”**: falta **mazo visual**, **rewind real**, **super-like** como concepto propio, **match semántico** (hoy el “match” es copy + celebración cada N likes), y un **post-match guiado** unificado.

**Objetivo:** que el usuario en **modo descubrimiento** sienta **ritmo, binario, stack y feedback inmediato**; que **ficha completa** sea **segundo paso**; que **“match”** en inmobiliaria tenga definición clara (interés fuerte + siguiente acción); que el sistema **aprenda** de likes/favoritos/super (ya hay afinidad por tipo en preview del asistente; falta en el deck principal).

---

## 2. Auditoría del producto actual (basada en código)

### 2.1 Discovery (`apps/web/src/app/feed/page.tsx`)

| Aspecto     | Qué hay hoy                                                                                                                                                    |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Deck        | **Una sola** `ListingCard` (`queue[0]`). No hay stack 2D con parallax ni preview de la siguiente.                                                              |
| Swipe       | Botones **Nope** / **Like** + POST `/swipes` + en Like también POST `/saved` con `LATER`.                                                                      |
| Ficha       | Tap en card → `router.push(/listing/:id)` → **salida inmediata** del flujo tipo deck.                                                                          |
| Continuidad | Precarga con `limit=20`, `loadMore` al quedar ≤1 card; cursor en feed API.                                                                                     |
| Feedback    | Toasts, vibración, celebración cada **5 likes** (mensaje tipo “matches” — **no es match bilateral**).                                                          |
| Rewind      | `handleUndo` **solo reinserta** la card en cola local; **no revierte** `SwipeDecision` en servidor → el ítem puede quedar excluido del feed real al refrescar. |
| Estrella    | Botón ★ = **Favorito** (`FAVORITE`), no “Super Like” con semántica propia.                                                                                     |
| Densidad    | Header con links (Lista, Favoritos, Consultas), barra de búsqueda activa, chips de filtro, CTA asistente → **mucho chrome** para un “modo inmersivo”.          |

### 2.2 Componente visual (`SwipeCard.tsx`)

- Card con **carrusel de fotos**, gradiente estilo app de citas, precio y zona en overlay: **buena base emocional**.
- No ocupa **full viewport** ni gesto de arrastre (drag-to-dismiss): la decisión es **solo por botones**.

### 2.3 Listado (`apps/web/src/app/feed/list/page.tsx`)

- **Lista virtualizada** (`react-window`), patrón **portal** (scan denso, muchas filas).
- Coherente como **“modo inventario”**, pero **compite** con la narrativa Tinder si es el camino por defecto o igual de visible.

### 2.4 Backend

| Recurso           | Comportamiento                                                                                              |
| ----------------- | ----------------------------------------------------------------------------------------------------------- |
| `POST /swipes`    | Upsert `SwipeDecision` LIKE/NOPE.                                                                           |
| Feed              | Excluye listings con decisión del usuario (`swipeDecisions: { none }` en `feed-engine`).                    |
| Afinidad          | `preview-affinity.ts`: reorden por tipo según **favoritos + likes** en **preview del asistente** solamente. |
| Leads / consultas | `InquiryModal`, `Lead`, flujo comercial existente.                                                          |

### 2.5 “Mis match” (`/me/match`)

- Agregación de favoritos / likes / leads: **útil post-descubrimiento**, pero el nombre “match” **no coincide** con un evento único tipo Tinder (no hay “hubo match con esta propiedad”).

---

## 3. Gap analysis — ¿cumple la promesa “Tinder inmobiliario”?

| Promesa percibida           | Estado         | Gap                                                                               |
| --------------------------- | -------------- | --------------------------------------------------------------------------------- |
| “Descubro en segundos”      | Parcial        | Un card ayuda; falta gesto + stack + menos distracciones.                         |
| Decisión binaria clara      | Sí (Nope/Like) | Tercera y cuarta acción (★ favorito, + lista) **rompen** el binario puro.         |
| Sensación de mazo           | No             | Una sola card; no hay “siguiente debajo”.                                         |
| Super Like / interés fuerte | No             | ★ es favorito, no señal prioritaria con límite ni CTA distinto.                   |
| Rewind                      | Parcial        | UX local sin sync servidor → **no confiable**.                                    |
| Match con significado       | No             | Celebración por contador; no hay **definición de match** inmobiliario.            |
| Post-match guiado           | Débil          | Usuario salta a ficha o listas; no hay **pasos**: guardar / comparar / consultar. |
| Ranking por afinidad        | Parcial        | Asistente sí; **deck principal** ordena por feed estándar (fecha/precio/etc.).    |
| Evitar fatiga               | Parcial        | Un card reduce densidad; listado y ficha larga **reintroducen** fatiga.           |

**Conclusión:** hay **swipe y cola**, pero la **metáfora Tinder no está cerrada** en UI, estado emocional (“match”), ni continuidad técnica (rewind).

---

## 4. Qué hoy lo hace parecer “portal” (Zonaprop-like)

1. **`/feed/list` como hermano equivalente** del deck (misma jerarquía mental: “ver todo en tabla”).
2. **Tap = ficha completa** sin capa intermedia (sheet con resumen + 1 CTA).
3. **Muchos enlaces de navegación** en la cabecera del feed.
4. **Búsqueda por filtros** y asistente **compiten** con el deck sin un **modo claro**: “Explorar” vs “Buscar”.
5. **Misma card** en listado y en deck sin diferenciar **densidad de información**.
6. **“Match”** usado en copy sin contrato de producto (usuario no sabe qué ganó).

---

## 5. Redefinición de conceptos (inmobiliaria real)

### 5.1 ¿Qué es “match” aquí?

En citas, match es **reciprocidad**. En inmobiliaria **no hay** el mismo simétrico salvo integración con dueño que “acepta” al comprador (futuro).

**Definición propuesta (P0 narrativo, P1 datos):**

- **Match de interés (usuario):** el usuario marcó **Like** o **Super Like** en una propiedad que **encaja con su búsqueda activa** (filtros / asistente). Es **unilateral** pero **nombrable**: “Te interesó esta propiedad”.
- **Match comercial (fuerte):** el usuario envió **consulta** o agendó **visita** → estado en CRM / lead. Es el **“it’s a match”** serio del negocio.

Producto debe **separar en UI**: “Te gustó” vs “Ya consultaste”.

### 5.2 Qué pasa después de un Like

Flujo objetivo:

1. **Feedback inmediato** (animación + microcopy): “Guardamos tu interés”.
2. **Opcional en la misma pantalla** (bottom sheet): Comparar / Favorito / Enviar consulta (sin obligar).
3. **Siguiente card** automático (mantener velocidad).
4. En **Mis match**: ver pipeline **Gustó → Favorito → Consulta enviada**.

### 5.3 Cuándo mostrar detalle completo

- **Durante discovery:** no como página completa por defecto; **bottom sheet** o **modal** con tabs (fotos, datos clave, mapa mini) + CTA “Ver ficha completa”.
- **Después de Super Like o Consulta:** permitir ficha completa como recompensa / paso natural.

### 5.4 Velocidad vs fatiga

- **Velocidad:** gesto, menos texto por card, prefetch del siguiente.
- **Fatiga:** límites suaves (pausa “¿Seguís buscando X?”), deduplicación, no mezclar listado denso en el mismo estado mental que el deck.

---

## 6. Tabla comparativa — Mecánica Tinder vs MatchProp

| Mecánica Tinder  | MatchProp hoy       | Dirección deseada                                                                     |
| ---------------- | ------------------- | ------------------------------------------------------------------------------------- |
| Stack de cards   | 1 card              | 2–3 visibles + sombra/offset                                                          |
| Swipe gestual    | Solo botones        | Drag + botones (accesibilidad)                                                        |
| Like             | Like + guarda LATER | Like claro; opcional unificar naming “Guardar en Mis intereses”                       |
| Nope             | Sí                  | Sí + opción “Ocultar 7 días” (futuro)                                                 |
| Super Like       | No (★ = favorito)   | Super Like con cupo diario + prioridad en “Mis match” / notificación interna          |
| Rewind           | No server           | DELETE o PATCH swipe + undo sync                                                      |
| Match mutuo      | N/A                 | Sustituir por **Match comercial** (consulta) o **Match de búsqueda** (encaje filtros) |
| Chat post-match  | N/A                 | **Consulta / WhatsApp / visita** como “chat” comercial                                |
| Boost / ranking  | No en deck          | Afinidad + búsqueda activa en orden del feed                                          |
| Perfil (detalle) | Ficha aparte        | Sheet primero, ficha después                                                          |

---

## 7. Prioridades

### P0 — Identidad “Tinder serio” (alto impacto, viable)

1. **Modo deck inmersivo:** menos chrome en `/feed`, CTA “Lista” como modo secundario.
2. **Stack visual** de 2 cards (siguiente atenuada).
3. **Rewind real:** endpoint para **revertir último swipe** + undo llama API.
4. **Definición de “match” en copy y UI:** dejar de usar “match” por contador; usar “Te gustó” / “En tu lista”.
5. **Post-like sheet:** 3 acciones (Favorito, Consultar, Ver más) sin salir del flujo obligatoriamente.

### P1 — Mecánicas distintivas

1. **Super Like** (modelo + UI + límite diario por plan).
2. **Drag-to-swipe** con física simple.
3. **Ranking por afinidad** en `executeFeed` (o capa de reorden parcial) alineado a favoritos/likes/búsqueda activa.
4. **“Modo explorar” vs “Modo buscar”** explícito en navegación.

### P2 — Profundidad y retención

1. Ocultar temporalmente / “Ya visto” inteligente.
2. Integración publicante: “El anunciante respondió” como evento tipo match.
3. Notificaciones / alertas conectadas a Super Like + nuevas propiedades encaje.
4. A/B copy y animaciones de celebración solo en hitos comerciales reales.

---

## 8. Cambios de UX/UI (por área)

| Área         | Cambio                                                                            |
| ------------ | --------------------------------------------------------------------------------- |
| `/feed`      | Layout full-bleed; botones flotantes; stack; opción ocultar top nav en scroll     |
| `SwipeCard`  | Ratio 3:4 o fullscreen móvil; menos título en primera vista; indicador “foto 2/6” |
| Post-acción  | Sheet con CTAs claros; no depender de `/listing` para decidir                     |
| `/feed/list` | Renombrar mentalmente a “Inventario” o “Ver todas”; icono secundario              |
| `/me/match`  | Kanban liviano: Interesado → Favorito → Consulta                                  |
| Asistente    | Transición explícita “Llevame al deck” con filtros aplicados                      |

---

## 9. Backend y lógica

| Tema            | Trabajo                                                                                               |
| --------------- | ----------------------------------------------------------------------------------------------------- |
| Rewind          | `DELETE /swipes/:listingId` o `POST /swipes/undo` (último en ventana de tiempo)                       |
| Super Like      | Nuevo enum o tabla `SuperLike` con `userId`, `listingId`, `createdAt`; cupo por día en `User` o Redis |
| Match semántico | Job o flag: listing cumple `activeSearch` → evento `SearchMatch` (analytics + UI badge)               |
| Feed order      | Parámetro `sort=affinity` o reorden server-side top-N tras query (similar a assistant preview)        |
| Idempotencia    | Mantener upsert actual; rewind debe borrar o marcar “undone”                                          |

---

## 10. Implementación por etapas

### Etapa A (1–2 sprints) — Percepción

- Stack visual 2 niveles + reducción de chrome en feed.
- Copy: eliminar “match” falso por contador; mensajes alineados a “Te gustó”.
- Sheet post-Like mínimo.

### Etapa B (2–3 sprints) — Confianza

- API + UI **rewind** consistente.
- Drag swipe (opcional toggle accesibilidad).
- Ficha completa solo desde sheet o segundo tap explícito.

### Etapa C (2–3 sprints) — Diferenciación

- Super Like + límites por plan.
- Afinidad en feed principal (top del batch).
- “Mis match” como pipeline visual.

### Etapa D — Comercial

- Eventos “match comercial” en CRM, emails, recordatorios visita.

---

## 11. Resumen final

MatchProp **ya tiene genes de Tinder** (cola, decisión binaria persistida, card visual fuerte), pero **el producto completo aún se lee como portal** por el listado equivalente, la ficha inmediata y la ausencia de **stack, rewind real, super-like y match definido**. Acercarse a Tinder **no es cosmética**: es **ritual de decisión + estado emocional honesto + siguiente paso comercial claro**.

La dirección correcta es: **deck = descubrimiento rápido y emocional**; **lista = inventario**; **ficha = profundidad**; **consulta = match de negocio**. Este documento fija el contrato y el orden de construcción **P0 → P2** para que la experiencia sea **claramente más Tinder que Zonaprop** en discovery, sin perder seriedad comercial.

---

## Referencias de código auditado

- `apps/web/src/app/feed/page.tsx` — deck, swipe, undo local, celebración.
- `apps/web/src/components/SwipeCard.tsx` — presentación de card.
- `apps/web/src/app/feed/list/page.tsx` — modo listado portal.
- `apps/api/src/routes/swipes.ts` — persistencia LIKE/NOPE.
- `apps/api/src/lib/feed-engine.ts` — exclusión por swipe, orden.
- `apps/api/src/services/assistant/preview-affinity.ts` — afinidad (preview asistente).
