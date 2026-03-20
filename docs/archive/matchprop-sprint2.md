# MatchProp Sprint 2 — Asistente IA + SavedSearch + Shortlist

## Alcance

- **Asistente de búsqueda**: texto → filtros estructurados (parser determinístico, sin LLM real)
- **SavedSearch**: guardar búsquedas con filtros
- **Resultados on-demand**: GET /searches/:id/results reutiliza motor del feed
- **Web**: /assistant, /searches, /searches/[id]

**No incluido en Sprint 2:**

- Alertas (solo hooks)
- Push real a Kiteprop API v1 (doc no disponible)
- LLM real (OpenAI) — interfaz lista, default determinístico

## Endpoints nuevos

| Método | Ruta                  | Descripción                                 |
| ------ | --------------------- | ------------------------------------------- |
| POST   | /assistant/search     | { text } → { filters, explanation }         |
| POST   | /searches             | { name?, text?, filters } → SavedSearch     |
| GET    | /searches             | Lista búsquedas del usuario                 |
| GET    | /searches/:id         | Detalle búsqueda                            |
| GET    | /searches/:id/results | Feed filtrado (limit, cursor, includeTotal) |

## Schema SearchFilters

```ts
interface SearchFilters {
  operationType?: 'SALE' | 'RENT';
  propertyType?: string[];
  priceMin?: number;
  priceMax?: number;
  bedroomsMin?: number;
  bathroomsMin?: number;
  locationText?: string; // trim + trunc 200
  currency?: string;
  keywords?: string[];
}
```

## Cómo probar en web

1. **Login**: `pnpm dev:web` → http://localhost:3000/login
2. **Ingest**: `pnpm --filter api ingest:run -- --source=KITEPROP_EXTERNALSITE --limit=200`
3. **Asistente**: ir a /assistant
   - Escribir: "departamento en Palermo, 2 dormitorios, hasta 100k USD"
   - Clic "Generar búsqueda"
   - Ver explanation + preview de filtros
   - Clic "Guardar búsqueda"
   - Clic "Ver resultados"
4. **Resultados**: /searches/[id] muestra cards con paginación
5. **Búsquedas**: /searches lista guardadas

## Smoke UX checklist

- [ ] Login OK
- [ ] /assistant: generar → guardar
- [ ] /searches: ver lista
- [ ] /searches/:id: ver results y paginar
- [ ] CTA "Volver al feed swipe"

## Verificación final (Sprint 2)

```bash
pnpm lint           # OK
pnpm format:check   # OK
pnpm -r typecheck   # OK
pnpm -r test        # OK (22 tests api lib)
pnpm --filter api test:all  # OK (68 tests)
```

### Archivos modificados en esta sesión

- `apps/api/src/lib/feed-engine.ts` — eliminadas constantes no usadas
- `apps/web/src/app/assistant/page.tsx` — import no usado
- `apps/api/vitest.config.ts` — `fileParallelism: false` para evitar race en tests DB
