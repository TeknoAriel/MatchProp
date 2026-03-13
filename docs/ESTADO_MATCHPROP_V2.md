# Estado MatchProp v2.0

Última actualización: Mar 2026

## Módulos

| Módulo              | Estado     | Evidencia              |
|---------------------|------------|------------------------|
| Auth demo           | Ajustado   | POST /auth/demo, fallback devLink |
| Magic link          | Ajustado   | Fallback a useDemo cuando API/DB falla |
| Feed (Match)        | Existe     | /feed                  |
| Feed lista          | Existe     | /feed/list             |
| Ficha propiedad     | Existe     | /listing/[id]          |
| Guardar/descarte    | Existe     | SwipeCard, saved       |
| Búsquedas guardadas | Existe     | /searches              |
| Alertas             | Existe     | /alerts                |
| Leads               | Existe     | /leads, pending/active |
| Admin/backoffice    | Parcial    | /leads                 |

## Acceso demo

- **Local:** `pnpm run dev-local` → http://localhost:3000/login
- **Producción:** https://match-prop-web.vercel.app/login → «Entrar con link demo»

## Pendiente (no prioritario)

- IA abierta, audio avanzado, wallet B2B, Mercado Pago, SEO avanzado
