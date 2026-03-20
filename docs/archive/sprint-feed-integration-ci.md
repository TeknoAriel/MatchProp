# Sprint: Feed Contract + Integración + CI + Consumidores

## Resumen

- **TICKET A**: Tests de integración `/feed` con DB
- **TICKET B**: Admin/mobile no consumen feed (reportado)
- **TICKET C**: CI con GitHub Actions
- **TICKET D**: Contract tests (zod) + documentación

---

## TICKET A — Tests de integración /feed

**Archivo**: `apps/api/src/routes/__tests__/feed.int.test.ts`

### Setup

- Usa `buildApp`, `app.inject()` (sin levantar servidor HTTP)
- `beforeAll`: crea usuario `feed-int-test@matchprop.com` y 25 Property
- `afterAll`: borra propiedades con prefijo `FeedIntTest `, cierra app

### Casos cubiertos

1. **Contrato FeedResponse (zod)**: response cumple schema
2. **Contrato base**: 200, items ≤ limit, shape card liviana (sin description/photos/createdAt)
3. **nextCursor**: presente cuando hay más items
4. **Paginación**: ids no se repiten entre page1 y page2
5. **includeTotal=false**: total === null
6. **includeTotal=1**: total es number, estable en page2 (cache)
7. **Cursor muy largo**: 400 INVALID_CURSOR
8. **Cursor base64 inválido**: 400 INVALID_CURSOR (mensaje genérico)
9. **locationText vía preference**: 200 OK

### Cómo ejecutar

```bash
docker compose up -d
pnpm --filter api exec prisma migrate deploy
pnpm --filter api test:all
```

---

## TICKET B — Consumidores

**Resultado**: Admin y mobile **no consumen** el endpoint `/feed`.

- `rg "/feed" apps/admin apps/mobile` → sin matches
- `rg "nextCursor|includeTotal"` → sin matches

No se requirieron cambios. Los tipos `FeedCard` y `FeedResponse` en `packages/shared` están listos para cuando se integre.

---

## TICKET C — CI

**Archivo**: `.github/workflows/ci.yml`

### Jobs

1. **typecheck**: `pnpm -r run typecheck`
2. **unit-tests**: `pnpm -r run test` (solo src/lib, sin DB)
3. **integration-tests**: Postgres 16 como service, `prisma migrate deploy`, `pnpm --filter api test:all`

### Triggers

- push/PR a `main` o `master`

---

## TICKET D — Hardening

### Contract tests

- **Schema Zod**: `apps/api/src/schemas/feed.ts` — `feedCardSchema`, `feedResponseSchema`
- El test de integración valida con `feedResponseSchema.safeParse()`

### Documentación

- Este archivo
- `docs/sprint-feed-security-cache.md` (sprint anterior)

---

## Comandos de verificación

| Comando                      | Requiere DB    |
| ---------------------------- | -------------- |
| `pnpm -r typecheck`          | No             |
| `pnpm -r test`               | No (solo unit) |
| `pnpm --filter api test:all` | Sí             |
| `pnpm lint`                  | No             |
| `pnpm format:check`          | No             |
