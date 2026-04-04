# Email de alertas (SendGrid)

## Comportamiento

Cuando el job de alertas crea un **`AlertDelivery`** nuevo (`alerts-runner` → `notifyAlertChannels`), se dispara **`sendAlertDeliveryEmail`** ([`apps/api/src/lib/alert-delivery-email.ts`](../apps/api/src/lib/alert-delivery-email.ts)) si el transport SendGrid está disponible.

- **Configuración:** `SendGridConfig` en DB (Settings) con `isEnabled` + API key cifrada, **o** variables `SENDGRID_API_KEY` y `SENDGRID_FROM` en entorno. Ver [`services/mailer`](../apps/api/src/services/mailer/index.ts) (`isSendGridAvailableForSend`, `getMailerForSend`).
- **Sin SendGrid:** no se envía email (in-app y push pueden seguir).
- **Tipos:** `NEW_LISTING`, `PRICE_DROP`, `BACK_ON_MARKET` — asunto y cuerpo definidos en `TYPE_COPY`.

## Pruebas

Tests unitarios: `apps/api/src/lib/__tests__/alert-delivery-email.test.ts` (mock de Prisma y mailer).

## Alineación plan Q3

Sprint 8 (plan H4) — fila **8.2 Email alertas**: cubierto en código + documentación + tests.
