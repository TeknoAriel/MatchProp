# MCP Kiteprop CRM (`kiteprop/crm-mcp`)

Servidor MCP que expone el CRM Kiteprop como herramientas para el asistente (propiedades, contactos, mensajes, difusiones, estadísticas).

- **Repositorio:** https://github.com/kiteprop/crm-mcp
- **Requisitos:** Node.js 18+
- **Autenticación:** clave personal API (`kp_...`) generada en el CRM por cada usuario (no es una clave global del repo).

## Variables

| Variable             | Descripción                                     |
| -------------------- | ----------------------------------------------- |
| `KITEPROP_API_URL`   | Base del CRM, p. ej. `https://www.kiteprop.com` |
| `KITEPROP_API_TOKEN` | Tu API key personal (`kp_...`)                  |

Cuando tengas la key, reemplazá el placeholder en tu configuración local (no la subas al repo).

## Cursor

1. Abrí la configuración MCP de Cursor: **Settings → MCP** (o el JSON de servidores MCP según tu versión).
2. Agregá un servidor con **command** `npx`, **args** `["-y", "github:kiteprop/crm-mcp"]` y las env vars anteriores.
3. Reiniciá Cursor o recargá los servidores MCP.

Fragmento equivalente (copiar y pegar en el esquema que use tu cliente; ver también `mcp.kiteprop-crm.example.json` en la raíz del monorepo):

```json
{
  "mcpServers": {
    "kiteprop-crm": {
      "command": "npx",
      "args": ["-y", "github:kiteprop/crm-mcp"],
      "env": {
        "KITEPROP_API_URL": "https://www.kiteprop.com",
        "KITEPROP_API_TOKEN": "<tu-clave-kp_>"
      }
    }
  }
}
```

## Claude Desktop

Archivo `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS), bloque `mcpServers` como arriba. Ver README del repo crm-mcp.

## Claude Code

Archivo `.mcp.json` en la raíz del proyecto, mismo formato.

## Más información

Lista de tools y prompts de ejemplo: https://github.com/kiteprop/crm-mcp/blob/main/README.md
