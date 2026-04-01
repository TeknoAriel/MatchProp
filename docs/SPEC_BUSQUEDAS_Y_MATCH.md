# Especificación: Búsquedas guardadas, Mis match y Mis alertas

Especificación para reorganizar la UX de búsquedas, match y alertas. **Prioridad:** ejecutar antes de continuar con Sprint 7.

**Última actualización:** 2026-03-29

---

## Estado actual (2026-03) vs pendiente

| Área                | Implementado hoy                                                                                                            | Pendiente respecto a este spec                                                                                        |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Búsquedas guardadas | Listado, detalle por id, guardar/editar copia, barra de búsqueda activa, `activeSearchId` al crear                          | Acciones unificadas en **card** (§1.1), menú alertas en card (§1.2), bloque resultados de alertas por búsqueda (§1.3) |
| Feed / match        | `/feed` con búsqueda activa o `feed=all`, cursor con relajación, empty state con CTA al asistente si no hay búsqueda activa | **`/me/match`** agregado multi-búsqueda y orden like > favoritos > resto (§3)                                         |
| Alertas             | `/alerts`, suscripciones, listado de entregas (`GET /alerts/deliveries`), email + in-app + **Web Push opcional** (VAPID)     | Pulir UX §4.2 (agrupar por búsqueda, etc.) si hace falta; canales push requieren env + migración en prod               |
| API                 | `POST/GET/PATCH/DELETE /searches`, `GET /alerts/deliveries`, `GET /alerts/deliveries/by-search/:savedSearchId`, subscribe push | `PATCH` opcional `isActiveForMatch`, `GET /me/match` (§5)                                                             |
| Modelo              | `User.activeSearchId`, `SavedSearch`                                                                                        | Campo opcional `isActiveForMatch` (§6) si se prioriza exclusión por búsqueda                                          |

La lista detallada de §1–§7 sigue siendo la **hoja de ruta**; esta tabla solo ancla qué está cubierto en código frente al documento original.

---

## 1. Búsquedas guardadas (`/searches`)

### 1.1 Acciones por card

Cada card de búsqueda guardada debe incluir:

| Acción              | Comportamiento                                                                                                        | Ubicación en card |
| ------------------- | --------------------------------------------------------------------------------------------------------------------- | ----------------- |
| **Editar**          | Abre modal/página para cambiar filtros o texto; al guardar, vuelve a buscar con los nuevos criterios                  | Botón "Editar"    |
| **Eliminar**        | Borra la búsqueda (con confirmación)                                                                                  | Botón "Eliminar"  |
| **Activa/Inactiva** | Toggle: marca si esta búsqueda participa en "Mis match" (ver §3). Si inactiva, no aporta propiedades al feed agregado | Toggle en la card |
| **Match**           | Setea esta búsqueda como activa, hace fetch de resultados y redirige a `/feed` en modo swipe                          | Botón "Match"     |

### 1.2 Menú "Activar alertas"

- Dentro de cada card (o al expandir), acceso al menú de alertas de esa búsqueda.
- Tipos: **Nuevas publicaciones**, **Bajó el precio**, **Volvió al mercado**.
- Cada tipo tiene toggle on/off.
- Comportamiento idéntico al de `/searches/[id]` (sección Alertas).

### 1.3 Resultado de alertas por búsqueda

- **Debajo** del menú de activar alertas, dentro de la misma pantalla.
- Bloque: **"Resultado de alertas para esta búsqueda"**.
- Muestra los `AlertDelivery` asociados a las suscripciones de esa búsqueda (listings que dispararon alertas).
- Lista compacta: listing (título, precio, tipo de alerta, fecha).
- CTA "Ver en feed" o similar para ir a ver esos resultados en modo lista/match.

### 1.4 Flujo Editar

1. Usuario hace clic en "Editar" en una card.
2. Se abre modal o navega a formulario con filtros actuales pre-cargados.
3. Usuario modifica (ej. cambia ubicación, precio, ambientes).
4. Al guardar: `PUT /searches/:id` con nuevos datos; luego opcionalmente setear como activa y redirigir a feed o quedarse en búsquedas.

---

## 2. Página de inicio (`/dashboard` o `/`)

### 2.1 Búsqueda destacada

- Mantener el buscador como está (input + voz + sugerencias).
- Darle más prominencia visual si hace falta.

### 2.2 Botón "Mis match"

- **Ubicación:** destacado, junto o debajo de la búsqueda (nivel similar de prominencia).
- **Label:** "Mis match".
- **Destino:** nueva ruta `/me/match` (ver §3).
- **Descripción corta:** "Propiedades de tus búsquedas activas, ordenadas por like y favoritos".

### 2.3 Botón "Mis alertas"

- **Ubicación:** mismo nivel que "Mis match".
- **Destino:** `/alerts` (ya existe).
- **Contenido:** mismo que la barra lateral "Mis alertas" — resultado de todas las alertas activas.
- Si `/alerts` ya muestra eso, el botón simplemente redirige ahí. Si no, adaptar `/alerts` para que sea la vista unificada de resultados de alertas.

---

## 3. Mis match (`/me/match`) — Definición

### 3.1 Fuente de datos

**Mis match** muestra el listado de propiedades que provienen de **todas las búsquedas activas** del usuario.

- **Búsqueda activa:** SavedSearch con `isActive = true` (ver §3.3) o, en el modelo actual, la búsqueda activa única (`User.activeSearchId`) más las que el usuario marque como "activas" para este feed.
- **Propuesta de modelo:** agregar campo opcional `SavedSearch.isActiveForMatch` (boolean, default true). Si false, esa búsqueda no aporta al feed "Mis match".
- **Alternativa sin cambio de schema:** considerar "activas" = todas las SavedSearch del usuario; o solo la `activeSearchId` si existe.

### 3.2 Orden de resultados

1. **Primero:** propiedades con **like** (`SavedItem` listType = LATER).
2. **Segundo:** propiedades en **favoritos** (`SavedItem` listType = FAVORITE).
3. **Tercero:** el resto de propiedades que arrojen las búsquedas activas (por fecha, relevancia, etc.).

Deduplicar por `listingId` (una propiedad no se repite).

### 3.3 Agregación de búsquedas

- Si el usuario tiene **una** búsqueda activa: usar `GET /feed` con los filtros de esa búsqueda (ya existe).
- Si queremos **varias** búsquedas activas: hace falta nuevo endpoint, ej. `GET /me/match` que:
  - Obtiene los `SavedSearch` "activos para match" del usuario.
  - Ejecuta el feed para cada uno (o query unificada con OR de filtros).
  - Une resultados, deduplica, ordena por like > favoritos > resto.
  - Devuelve lista paginada.

### 3.4 UI de Mis match

- Vista en lista (estilo `/feed/list`).
- Mismo tipo de cards que feed: imagen, título, precio, acciones (like, favorito, lista, consulta).
- Posible vista alternativa en modo swipe (reutilizar componente de `/feed`).

---

## 4. Mis alertas (`/alerts`)

### 4.1 Contenido actual

- Lista de suscripciones (AlertSubscription) con toggle activa/pausada, eliminación, "Ver resultados".
- Cada suscripción está asociada a una búsqueda.

### 4.2 Mejora deseada

- **"Resultado de alertas"** = listado unificado de los `AlertDelivery` de todas las suscripciones activas.
- Agrupar por suscripción o mostrar en una sola lista con indicador de tipo (nueva, bajó precio, volvió).
- Misma UX que "Resultado de alertas para esta búsqueda" (§1.3) pero a nivel global.

---

## 5. Cambios de API necesarios

| Endpoint                             | Cambio                       | Notas                                                               |
| ------------------------------------ | ---------------------------- | ------------------------------------------------------------------- |
| `PUT /searches/:id`                  | Crear si no existe           | Editar nombre, queryText, filters                                   |
| `DELETE /searches/:id`               | Ya puede existir             | Eliminar búsqueda                                                   |
| `PATCH /searches/:id`                | Opcional: `isActiveForMatch` | Toggle activa/inactiva para Mis match                               |
| `GET /me/match`                      | Nuevo                        | Feed agregado de búsquedas activas, orden like > favoritos > resto  |
| `GET /alerts/deliveries` o similar   | Nuevo o extender             | Listado de AlertDelivery para el usuario (por suscripción o global) |
| `GET /searches/:id/alert-deliveries` | Nuevo                        | AlertDelivery de las suscripciones de esa búsqueda                  |

---

## 6. Cambios de modelo (opcional)

| Modelo      | Campo            | Tipo                  | Descripción                                           |
| ----------- | ---------------- | --------------------- | ----------------------------------------------------- |
| SavedSearch | isActiveForMatch | Boolean, default true | Si true, esta búsqueda aporta propiedades a Mis match |

Si no se quiere cambiar el schema, "activas" = todas las SavedSearch del usuario (o solo la activeSearchId).

---

## 7. Orden de implementación sugerido

1. **Búsquedas guardadas — acciones en card:** Editar, Eliminar, Activa/Inactiva, Match.
2. **Búsquedas guardadas — menú alertas:** Integrar en cada card el menú de activar alertas (reutilizar lógica de `/searches/[id]`).
3. **Búsquedas guardadas — resultado alertas:** Bloque "Resultado de alertas para esta búsqueda" con endpoint `GET /searches/:id/alert-deliveries`.
4. **Dashboard — botones Mis match y Mis alertas:** Destacar ambos en la página de inicio.
5. **Mis match — API y página:** `GET /me/match`, página `/me/match` con lista ordenada.
6. **Mis alertas — resultados unificados:** Extender `/alerts` o crear vista de resultados de AlertDelivery global.

---

## 8. Referencias

- [searches/page.tsx](../../apps/web/src/app/searches/page.tsx) — Búsquedas guardadas (baseline)
- [searches/[id]/page.tsx](../../apps/web/src/app/searches/[id]/page.tsx) — Resultados y alertas por búsqueda
- [alerts/page.tsx](../../apps/web/src/app/alerts/page.tsx) — Mis alertas
- [dashboard/page.tsx](../../apps/web/src/app/dashboard/page.tsx) — Inicio
- [PLAN_DE_TRABAJO_2026_Q3.md](./PLAN_DE_TRABAJO_2026_Q3.md) — Plan siguiente
