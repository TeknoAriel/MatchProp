# Asistente de búsqueda inmobiliaria — arquitectura

**Última actualización:** Mar 2026.

## 1. Auditoría del estado previo

- Ya existía **POST `/assistant/search`** (texto → `SearchFilters` + explicación) y **POST `/assistant/preview`** (filtros → ítems del feed real vía `executeFeed`).
- El intérprete era **100 % determinístico** (`search-parser.ts`): regex y sinónimos alineados con `amenity-filter.ts` y con los filtros de `feed-engine` / Prisma.
- La UI en **`/assistant`** ya integraba **voz** (Web Speech API → texto → mismo pipeline).
- **Chat** (`/assistant/chat`) es conversacional genérico y no sustituye al motor de búsqueda.

## 2. Elección de modelo (por qué no solo LLM ni solo reglas)

| Enfoque | Pros | Contras |
|--------|------|--------|
| Solo reglas | Rápido, barato, testeable, control total sobre WHERE | Frágil ante frases muy libres o errores de voz |
| Solo LLM | Flexible semánticamente | Costo, latencia, alucinaciones en enums, más difícil de testear |
| **Híbrido (elegido)** | Reglas cubren la mayoría del tráfico y fijan límites; LLM opcional completa huecos y notas | Requiere merge disciplinado y feature flag por config |

**Decisión:** **reglas duras primero** + **LLM opcional** (OpenAI-compatible JSON) cuando `AssistantConfig` está habilitada con API key. Anthropic queda fuera del intent JSON en esta iteración (el chat sigue disponible).

## 3. Pipeline end-to-end

1. **Entrada:** texto o transcripción de voz (mismo pipeline).
2. **Refinamiento (opcional):** si el body incluye `previousFilters`, `applyRefinementCommands` ajusta la base (“más barato”, “solo depto”, “con cochera”, etc.).
3. **Parse determinístico:** `parseSearchText` → `SearchFilters` + `softPreferences` (regex).
4. **Merge:** `mergeCarriedAndParsed(refinamiento, parse)`.
5. **LLM (opcional):** `completeIntentWithLlm` devuelve `filtersPatch`, soft/lifestyle y `notes`; **solo rellena campos vacíos** salvo unión de `amenities` (`mergeLlmPatchOntoDeterministic`).
6. **Intent de producto:** `buildSearchIntent` expone `strictFilters`, soft, confianza, `rawQuery`, `usedLlm`.
7. **Resultados:** la UI llama `/assistant/preview` con los mismos filtros que el feed + `softPreferences` para un **reordenamiento leve** tras la afinidad por engagement.

## 4. Archivos clave

| Ruta | Rol |
|------|-----|
| `apps/api/src/services/assistant/search-parser.ts` | Reglas + amenities + ubicación + precio + `extractSoftPreferences` |
| `apps/api/src/services/assistant/search-refinement.ts` | Comandos de refinamiento sobre `previousFilters` |
| `apps/api/src/services/assistant/search-interpreter.ts` | Orquestación + `loadIntentLlmConfig` |
| `apps/api/src/services/assistant/intent-llm.ts` | Llamada JSON al proveedor OpenAI-compatible |
| `apps/api/src/services/assistant/build-search-intent.ts` | `SearchIntent` desde filtros |
| `apps/api/src/services/assistant/preview-soft-rank.ts` | Ranking por señales blandas en título/zona |
| `apps/api/src/routes/assistant.ts` | `previousFilters` en body; `softPreferences` en preview |
| `apps/web/src/app/assistant/page.tsx` | Refinamiento automático, “desde cero”, soft en preview |

## 5. Dataset y amenities

Las claves canónicas salen de **`AMENITY_SPECS`** (`amenity-filter.ts`). El listado para el prompt LLM se genera con **`listCanonicalAmenityKeys()`**. No se deben inventar filtros fuera de `SearchFilters` / Prisma.

## 6. Límites actuales

- LLM de intención: **solo proveedor OpenAI-compatible** con `response_format: json_object`.
- Señales blandas **no** abren nuevos campos en DB; influyen en copy y en orden del preview.
- Refinamiento conversacional: basado en **última respuesta** en cliente + `previousFilters`; no hay sesión server-side multi-turn almacenada.

## 7. Próximos pasos posibles

- Sesión server-side de intención (id + historial).
- Soporte Anthropic para intent JSON.
- Pesos de ranking aprendidos o feedback explícito del usuario.

## 8. Pruebas

- `apps/api/src/services/assistant/__tests__/search-interpreter.test.ts` — casos obligatorios de frases (sin LLM).
- `apps/api/src/services/assistant/__tests__/search-refinement.test.ts` — refinamiento.
- `apps/api/src/services/assistant/__tests__/search-parser.test.ts` — regresión del parser.
