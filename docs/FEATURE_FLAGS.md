# Feature flags — MatchProp

**Estado:** Mínimo (env-based). Formalización con tabla/UI pendiente.

**Producción:** Ver [PROD.md](./PROD.md) — checklist pre-deploy, DEMO_MODE=0 obligatorio, flags alineados.

---

## Flags vía variables de entorno

| Variable                             | Efecto                                                | Default |
| ------------------------------------ | ----------------------------------------------------- | ------- |
| `DEMO_MODE`                          | Habilita modo demo, fixture ingest, página /status    | —       |
| `STRIPE_SECRET_KEY`                  | Activa checkout Premium y webhooks Stripe             | —       |
| `CRM_WEBHOOK_URL`                    | Habilita push de eventos listing.matches_found al CRM | —       |
| `KITEPROP_EXTERNALSITE_MODE=fixture` | Ingest desde JSON local en lugar de URL externa       | —       |

## Uso en código

Para comprobar si una funcionalidad está disponible:

- **Stripe:** existe `STRIPE_SECRET_KEY` (no exponer en cliente).
- **Demo:** `process.env.NEXT_PUBLIC_DEMO_MODE` o en API `process.env.DEMO_MODE`.
- **CRM webhook:** en API, comprobar `process.env.CRM_WEBHOOK_URL`.

## Próximos pasos (opcional)

- Tabla `FeatureFlag` en DB con nombre, enabled, rollout %.
- Endpoint `GET /me/feature-flags` para el cliente.
- Panel Admin para activar/desactivar sin deploy.
