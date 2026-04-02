# Importadores, API Universal y Asistente IA

## Fuentes de importación (Settings)

**Ruta:** `/settings/integrations/importers` (admin)

Configuración según documentación Kiteprop. Formato JSON:

```json
{
  "externalsite": [
    {
      "url": "https://static.kiteprop.com/kp/difusions/4b3c894a10d905c82e85b35c410d7d4099551504/externalsite-2-9e4f284e1578b24afa155c578d05821ac4c56baa.json",
      "format": "json"
    }
  ],
  "properstar": [
    { "url": "https://static.kiteprop.com/kp/difusions/.../properstar.json", "format": "json" }
  ],
  "zonaprop": [{ "url": "https://.../zonaprop.xml", "format": "xml" }]
}
```

- **externalsite:** Token Kiteprop (KITEPROP_EXTERNALSITE). URL por defecto incluida.
- **properstar:** Catálogo JSON completo (Properstar; mismo conector que el histórico yumblin). Detalle: [INGEST_PROPERSTAR.md](./INGEST_PROPERSTAR.md).
- **yumblin:** Clave legacy en `sourcesJson`; misma fuente que properstar si solo usás esa entrada.
- **URL alternativa:** `KITEPROP_EXTERNALSITE_URL`, `KITEPROP_DIFUSION_PROPERSTAR_URL` o `KITEPROP_DIFUSION_YUMBLIN_URL` en .env.

---

## API Universal

Endpoints REST para integradores. Header `X-API-Key`. Variable: `API_UNIVERSAL_KEY`.

| Endpoint                  | Descripción                                                                 |
| ------------------------- | --------------------------------------------------------------------------- |
| `GET /universal/feed`     | Feed paginado (cursor). Query: limit, cursor, operation, minPrice, maxPrice |
| `GET /universal/listings` | Lista con offset. Query: limit, offset, source                              |
| `GET /universal/health`   | Healthcheck                                                                 |

```bash
curl -H "X-API-Key: TU_API_KEY" "http://localhost:3001/universal/feed?limit=10"
```

---

## Asistente IA (API key y conversacional)

**Ruta:** `/settings/integrations/assistant` (admin)

- **Provider:** openai | anthropic | azure | custom
- **API Key:** cifrada con INTEGRATIONS_MASTER_KEY
- **Modelo búsqueda:** gpt-4o-mini, etc.
- **Modelo conversacional:** para chat

**Endpoint conversacional:** `POST /assistant/chat`

- Body: `{ "message": "...", "history": [{ "role": "user|assistant", "content": "..." }] }`
- Listo para conectar OpenAI, Claude, Azure o custom.

---

## Token Kiteprop (externalsite)

```
https://static.kiteprop.com/kp/difusions/4b3c894a10d905c82e85b35c410d7d4099551504/externalsite-2-9e4f284e1578b24afa155c578d05821ac4c56baa.json
```

Variable: `KITEPROP_EXTERNALSITE_URL`. O desde Settings → Importadores → externalsite.
