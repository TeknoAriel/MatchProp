# Ingest Properstar (catálogo JSON Kiteprop)

## Qué es

**`properstar.json`** es el archivo de difusión en `static.kiteprop.com` con el **catálogo completo** de propiedades en formato JSON. Comparte el mismo esquema que el histórico **`yumblin.json`** (campos como `id`, `images`, `property_type`, `for_sale` / `for_rent`, precios, `agency`, ubicación, etc.).

En la base de datos y en Prisma el origen sigue registrándose como **`KITEPROP_DIFUSION_YUMBLIN`** para no migrar datos ni el enum `ListingSource`. La clave nueva en configuración es **`properstar`**; **`yumblin`** en `sourcesJson` sigue soportada como alias (misma fuente).

## URL canónica (ejemplo)

```
https://static.kiteprop.com/kp/difusions/f89cbd8ca785fc34317df63d29ab8ea9d68a7b1c/properstar.json
```

Cuando Kiteprop publique otra carpeta de difusión, actualizá la URL en **Settings → Importadores** o en variables de entorno.

## Configuración

### 1. `IngestSourceConfig.sourcesJson` (admin / seed)

```json
{
  "properstar": [
    {
      "url": "https://static.kiteprop.com/kp/difusions/.../properstar.json",
      "format": "json"
    }
  ]
}
```

Si solo tenés la clave legacy `yumblin` con URL, el conector la sigue leyendo.

### 2. Variables de entorno

| Variable | Uso |
| -------- | --- |
| `KITEPROP_DIFUSION_PROPERSTAR_URL` | Prioridad sobre DB y sobre el default embebido en código. |
| `KITEPROP_DIFUSION_YUMBLIN_URL` | Alias legado; mismo conector. |
| `KITEPROP_DIFUSION_YUMBLIN_MODE=fixture` | Tests / CI: no hace fetch; usa fixture local. |

Prioridad de URL en runtime: **PROPERSTAR_URL → YUMBLIN_URL → `sourcesJson.properstar[0]` → `sourcesJson.yumblin[0]` → default en código**.

## Cargar el 100 % del catálogo

El archivo puede pesar **decenas de MB**. El conector mantiene **caché en memoria por URL** dentro del mismo proceso Node: al avanzar con `cursor` en varios batches **no** vuelve a parsear el JSON completo en cada batch.

### Recomendado (una sola corrida)

Desde la raíz del monorepo, con API y `.env` apuntando a la base correcta:

```bash
pnpm --filter api ingest:run -- --source=KITEPROP_DIFUSION_YUMBLIN --limit=8000 --until-empty
```

- `--limit=8000` coincide con el tope interno del procesador de ingest (máx. 8000 por evento).
- `--until-empty` repite ingest hasta que `nextCursor` sea `null`.

### Memoria y entorno

- Corré el comando en una máquina con **RAM suficiente** para `JSON.parse` del archivo completo (orden de **cientos de MB** en heap durante el parse).
- En **serverless** muy limitado, preferí ejecutar este bulk en **CI**, **VM** o tu laptop contra la misma `DATABASE_URL`.

## Cron y otras fuentes

- `pnpm --filter api ingest:cron` recorre las fuentes activas; si `properstar` (o `yumblin`) tiene URL en config, se ingestan **200 ítems por pasada** (cursor en `SyncWatermark`).
- El endpoint **`POST /cron/ingest`** del repo hoy dispara otra fuente (`KITEPROP_EXTERNALSITE`); no sustituye este flujo. Para Properstar en producción, programar **`ingest:cron`** o ampliar el cron HTTP según operación.

## Documentación relacionada

- [IMPORTADORES_Y_API_UNIVERSAL.md](./IMPORTADORES_Y_API_UNIVERSAL.md) — formato JSON de Settings.
- [INGEST_CRON_Y_ACTUALIZACIONES.md](./INGEST_CRON_Y_ACTUALIZACIONES.md) — cursores y SyncWatermark.
- [ENV_REFERENCIA.md](./ENV_REFERENCIA.md) — variables de entorno.
