# MatchProp: modelo de búsqueda y matching

**Propósito:** definir criterios, capas de UX, modos de efecto de cada filtro y relajación progresiva sin convertir MatchProp en un portal de filtros duros. **Discovery-first**, swipe/match-first, superficie simple y lógica potente en profundidad.

**Identidad:** MatchProp complementa a Propieya y KiteProp como productos paralelos; puede consumir feeds y atributos de partners, pero **no copia su complejidad de filtros en la primera capa**.

---

## 1. Principio central

1. Entender **intención** (operación, tipo, zona, precio aproximado).
2. Buscar **coincidencias fuertes** (core + flexibles).
3. **Relajar** lo secundario de forma ordenada si hay pocos resultados.
4. Mostrar **similares** o **catálogo** sin traicionar la intención principal cuando sea posible.
5. Evitar estado vacío prematuro y exigir pocos campos en el primer uso.

**Prioridad:** intención explícita → descubrimiento útil → continuidad → relevancia → sensación de progreso.

---

## 2. Tres niveles de intención (conceptual)

| Nivel                      | Contenido                                                            | Rol en el motor                                           |
| -------------------------- | -------------------------------------------------------------------- | --------------------------------------------------------- |
| A. Intención principal     | Compra/alquiler, tipo, macro zona, precio/tamaño aproximados         | Core / required                                           |
| B. Condiciones importantes | Dorm, baños, superficie, cochera, apto crédito, antigüedad, expensas | Mayormente **flexible** (WHERE con relajación)            |
| C. Preferencias de match   | Amenities, estilo de vida, subjetivos, datos incompletos             | **Preferred** (score / ranking), no exclusión por defecto |

---

## 3. Clasificación por impacto (A–D)

| Grupo                       | Ejemplos                                                                       | Comportamiento por defecto                        |
| --------------------------- | ------------------------------------------------------------------------------ | ------------------------------------------------- |
| **A. Core / required**      | Operación, tipo, macro ubicación, estado ACTIVE publicable                     | Siempre en WHERE; no se relajan                   |
| **B. Fuertes / flexible**   | Precio, dorm, ambientes, baños, superficie, cochera, apto crédito (contextual) | WHERE fuerte; relajables por etapas               |
| **C. Secundarios**          | Orientación, piso, cubierta mín/máx, amoblado, mascotas, expensas              | WHERE opcional; relajar antes que core            |
| **D. Preferidos / ranking** | Amenities, microdetalles, términos aspiracionales                              | **No excluyen** si `amenitiesMode=soft` (default) |

---

## 4. Modos de efecto: `required` / `flexible` / `preferred`

| Modo          | Significado                                                  |
| ------------- | ------------------------------------------------------------ |
| **required**  | Debe cumplirse (WHERE)                                       |
| **flexible**  | Se intenta cumplir; se puede relajar si hay pocos resultados |
| **preferred** | No excluye; mejora score, orden o copy                       |

**Asignación inicial MatchProp:**

- **required:** operación, tipo principal, macro ubicación (texto), estado del aviso.
- **flexible:** precio, dormitorios, ambientes, baños, superficie, cochera, apto crédito (salvo marcado indispensable).
- **preferred:** amenities en modo **soft** (por defecto), palabras subjetivas, datos incompletos.

---

## 5. Amenities (regla especial)

- **Por defecto** (`amenitiesMode=soft`): **no** van a `WHERE`; no vacían resultados.
- **Estricto** (`amenitiesMode=strict`): amenity en `WHERE` (AND sobre características normalizadas).
- **Dato null / no informado:** no interpretar como “no tiene”; **no excluir** por ausencia de dato.
- **Presente en el feed:** suma score cuando haya capa de ranking.
- **Sugerencias rápidas en UI:** se tratan como **preferred** salvo que el usuario active “indispensable” (strict).

---

## 6. Relajación progresiva (orden implementado en API)

Si la primera consulta devuelve 0 ítems, se aplica **relajación acumulativa por pasos** (sin tocar operación, tipo ni ubicación textual).

| Paso | Qué se relaja                                                                                                      |
| ---- | ------------------------------------------------------------------------------------------------------------------ |
| 1    | Amenities (si estaban en strict), fotos mínimas, antigüedad del aviso, palabras clave, texto en título/descripción |
| 2    | Apto crédito, superficie cubierta mínima                                                                           |
| 3    | Dormitorios, baños, superficie total                                                                               |
| 4    | Precio y moneda                                                                                                    |
| 5    | Bounds del mapa (viewport / polígono en query)                                                                     |

**No relajar primero:** operación, tipo principal, macro ubicación (texto).

**Umbrales orientativos (producto):** ≥20 resultados: ordenar por score; 8–19: mantener core + flexibles principales; 1–7: relajar más; 0: relajar hasta catálogo o “similares” (evolución futura).

---

## 7. Tipos de match (motor)

| Tipo        | Definición operativa actual                                                                             |
| ----------- | ------------------------------------------------------------------------------------------------------- |
| **exact**   | Filtros del usuario sin paso de relajación                                                              |
| **relaxed** | Se aplicó al menos un paso de relajación y hubo resultados                                              |
| **catalog** | Sin coincidencias con filtros; se devuelve exploración del catálogo (mismas reglas de calidad y swipes) |

**Orden deseado en listados compuestos:** exactos primero → relajados → similares (catálogo / ranking) — la paginación actual usa un solo conjunto; la mezcla multi-bucket es evolución futura.

---

## 8. Mapa y geografía

- Polígono o bounds: restricción **fuerte** al inicio; **relajar al final** (paso 5) si hay pocos resultados.
- Navegación sin área fija: viewport como **contexto**, no exclusión absoluta.
- Si se “expande” la zona: informar en UI (mensajes de ayuda, no solo “sin resultados”).

---

## 9. Capas de UI (orden recomendado)

### Capa 1 — Búsqueda simple / descubrimiento

1. Intención / operación
2. Tipo principal
3. Ciudad / zona
4. Precio orientativo
5. Dormitorios o tamaño base
6. Enlace a mapa
7. Palabras clave / intención libre
8. Sugerencias rápidas (amenities como preferencia, no muro)

### Capa 2 — Ajustes importantes

Baños, cocheras (si aplica), superficie mín/máx, cubierta, apto crédito, antigüedad del aviso, expensas (cuando existan), piso / disposición / orientación (cuando existan).

### Capa 3 — Afinar / estilo de vida

Amenities (con modo soft/strict), confort, edificio, entorno, lifestyle, atributos extendidos del feed.

**Orden sugerido de amenities (popularidad / inventario / tipo):** balcón, cochera, terraza, pileta, parrilla, jardín, aire acondicionado, seguridad, gimnasio, lavadero, SUM (ajustable por datos).

---

## 10. Swipe / feed / señales

Las señales de comportamiento (likes, skips, tiempo, zonas vistas, etc.) **complementan** la intención declarada; **no la reemplazan**.

Prioridad: intención actual → búsqueda activa → comportamiento reciente → histórico → inferidas.

---

## 11. Mensajes UX (evitar solo “sin resultados”)

Ejemplos:

- “Encontramos X opciones muy alineadas”
- “Te mostramos también coincidencias cercanas”
- “Tomamos algunos criterios como preferencia para mostrarte más opciones”
- “Estas opciones respetan tu intención principal”
- “Sumamos alternativas cerca de la zona elegida”

Mostrar si es posible: obligatorios / flexibles / preferidos (en copy o tooltips).

---

## 12. Analítica sugerida

- Tasa de búsquedas vacías
- Tasa resueltas con relajación (`matchTier=relaxed`)
- Filtros que más reducen inventario
- Amenities más usados vs más presentes en inventario
- % de feed con dato incompleto por atributo
- Uso de mapa / polígono
- Impacto del swipe en ranking (futuro)
- Brecha declarado vs comportamiento real

---

## 13. Criterios de aceptación (producto)

1. Baja la tasa de vacíos “injustificados”.
2. Primeras capas simples.
3. Potencia sin abrumar.
4. Amenities no destruyen resultados por defecto.
5. Coincidencias exactas primero cuando existan.
6. Relajados y catálogo sin traicionar intención principal (operación/tipo/zona).
7. Mapa y polígono sin rigidizar de más.
8. Sensación distinta a un portal tradicional.
9. Compatibilidad con feeds de partners sin depender su UI.

---

## 14. Ejemplos

### 14.1 “Comprar casa con jardín y pileta en Funes hasta 120 mil”

- Compra, casa, Funes = **required**
- Hasta 120 mil = **flexible** (WHERE con posible relajación)
- Jardín y pileta = **preferred** por defecto (soft); si el usuario marca “indispensable” → **strict** en amenities

### 14.2 “Algo tranquilo, moderno y luminoso”

- No debe vaciar la búsqueda: debe alimentar **ranking**, copy y orden; no exclusión dura salvo que no haya otra señal.

### 14.3 Relajación

Usuario con muchos filtros + bounds de mapa → 0 resultados → paso 1 quita amenities estrictos y texto… → paso 5 amplía bounds si aún no hay nada → catálogo.

---

## 15. Referencia técnica (API)

- Query `amenitiesMode`: `soft` (default) | `strict`. Alternativa: `amenitiesStrict=1` → `strict`.
- Respuesta `GET /feed`: `matchTier` (`exact` | `relaxed` | `catalog`), `relaxAppliedStep` (1–5 o null).
- Implementación: `apps/api/src/routes/feed.ts` (`filtersToWhere`, `relaxFeedFiltersAccum`).
