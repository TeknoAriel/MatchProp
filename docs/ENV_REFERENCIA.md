# Referencia de variables de entorno

Tokens y URLs usados en el proyecto, sin valores reales.

---

## URLs (producción)

| Variable                | Valor Producción                           | Dónde             |
| ----------------------- | ------------------------------------------ | ----------------- |
| `APP_URL`               | `https://match-prop-web.vercel.app`        | API               |
| `API_PUBLIC_URL`        | `https://match-prop-admin-dsvv.vercel.app` | API               |
| `API_SERVER_URL`        | `https://match-prop-admin-dsvv.vercel.app` | Web (server-side) |
| `NEXT_PUBLIC_API_URL`   | `https://match-prop-admin-dsvv.vercel.app` | Web (cliente)     |
| `NEXT_PUBLIC_ADMIN_URL` | `https://match-prop-admin.vercel.app`      | Web (opcional)    |
| `CORS_ORIGINS`          | `https://match-prop-web.vercel.app`        | API               |

> **Nota**: La API está desplegada en el proyecto `match-prop-api-1jte` con URL `match-prop-admin-dsvv.vercel.app`

---

## Base de datos

| Variable       | Formato                                                                              |
| -------------- | ------------------------------------------------------------------------------------ |
| `DATABASE_URL` | `postgresql://USER:PASS@HOST/DB?sslmode=require&connection_limit=20&pool_timeout=20` |

- **Neon:** host tipo `ep-xxx-pooler.REGION.aws.neon.tech`, DB `neondb`

---

## Tokens / secretos (generar con `openssl rand -base64 32`)

| Variable                  | Uso                                                       |
| ------------------------- | --------------------------------------------------------- |
| `JWT_SECRET`              | JWT de acceso                                             |
| `AUTH_JWT_SECRET`         | Override opcional para auth JWT                           |
| `AUTH_REFRESH_SECRET`     | Refresh tokens                                            |
| `INTEGRATIONS_MASTER_KEY` | API key master integraciones (32+ chars)                  |
| `CRM_WEBHOOK_SECRET`      | Firma webhook CRM                                         |
| `CRON_SECRET`             | Token para autorizar cron jobs (sync propiedades cada 6h) |

---

## OAuth

| Variable                 | Formato                         |
| ------------------------ | ------------------------------- |
| `GOOGLE_CLIENT_ID`       | `...apps.googleusercontent.com` |
| `GOOGLE_CLIENT_SECRET`   | string                          |
| `APPLE_CLIENT_ID`        | `com.tuapp.service`             |
| `APPLE_TEAM_ID`          | 10 caracteres                   |
| `APPLE_KEY_ID`           | 10 caracteres                   |
| `APPLE_PRIVATE_KEY`      | PEM (multilínea)                |
| `FACEBOOK_CLIENT_ID`     | numérico                        |
| `FACEBOOK_CLIENT_SECRET` | string                          |

---

## WebAuthn / Passkeys

| Variable           | Producción                                  |
| ------------------ | ------------------------------------------- |
| `WEBAUTHN_RP_ID`   | Dominio sin protocolo (ej. `matchprop.com`) |
| `WEBAUTHN_RP_NAME` | Nombre del producto                         |
| `WEBAUTHN_ORIGIN`  | `https://match-prop-web.vercel.app`         |

---

## Mercado Pago

| Variable                     | Formato                                                    |
| ---------------------------- | ---------------------------------------------------------- |
| `MERCADOPAGO_ACCESS_TOKEN`   | `APP_USR-xxx...` (sandbox) o `APP_USR-xxx...` (producción) |
| `MERCADOPAGO_PUBLIC_KEY`     | `APP_USR-xxx...`                                           |
| `MERCADOPAGO_WEBHOOK_SECRET` | string (opcional, para verificar IPN)                      |

> **Docs**: Ver `docs/MERCADOPAGO_SETUP.md` para configuración completa.

---

## Stripe

| Variable                    | Formato                       |
| --------------------------- | ----------------------------- |
| `STRIPE_SECRET_KEY`         | `sk_live_...` o `sk_test_...` |
| `STRIPE_PUBLIC_KEY`         | `pk_live_...` o `pk_test_...` |
| `STRIPE_WEBHOOK_SECRET`     | `whsec_...`                   |
| `STRIPE_PRICE_ID`           | `price_...` (fallback)        |
| `STRIPE_PRICE_BUYER`        | `price_...`                   |
| `STRIPE_PRICE_AGENT`        | `price_...`                   |
| `STRIPE_PRICE_REALTOR`      | `price_...`                   |
| `STRIPE_PRICE_INMOBILIARIA` | `price_...`                   |
| `STRIPE_COUPON_ORG_20`      | ID del cupón                  |

---

## Kiteprop / Ingest

| Variable                           | Formato                                                                |
| ---------------------------------- | ---------------------------------------------------------------------- |
| `KITEPROP_EXTERNALSITE_URL`        | `https://static.kiteprop.com/kp/difusions/.../externalsite-2-....json` |
| `KITEPROP_EXTERNALSITE_MODE`       | `fixture` \| `live`                                                    |
| `KITEPROP_DIFUSION_PROPERSTAR_URL` | URL JSON catálogo Properstar (prioridad sobre yumblin)                 |
| `KITEPROP_DIFUSION_YUMBLIN_URL`    | Alias legado; misma URL que properstar si no usás la variable anterior |
| `KITEPROP_DIFUSION_YUMBLIN_MODE`   | `fixture` \| live (sin valor: fetch real)                              |
| `KITEPROP_DIFUSION_*_MODE`         | `fixture` \| `live` (Zonaprop, Toctoc, Icasas)                         |
| `KITEPROP_API_BASE_URL`            | URL API Kiteprop                                                       |
| `KITEPROP_API_KEY`                 | API key                                                                |

---

## API Universal (integradores externos)

| Variable            | Formato                                                   |
| ------------------- | --------------------------------------------------------- |
| `API_UNIVERSAL_KEY` | API key (o varias separadas por coma). Header `X-API-Key` |

---

## CRM / Webhook

| Variable             | Formato               |
| -------------------- | --------------------- |
| `CRM_WEBHOOK_URL`    | `https://.../webhook` |
| `CRM_WEBHOOK_SECRET` | string de firma       |

---

## Flags

| Variable                           | Valores           | Uso                                                                                                              |
| ---------------------------------- | ----------------- | ---------------------------------------------------------------------------------------------------------------- |
| `DEMO_MODE`                        | `0` \| `1`        | Modo demo (auth relajada, fixtures). Requerido para "Entrar con link demo" (junto con `DATABASE_URL` en la API). |
| `PREMIUM_GRACE_PERIOD`             | `0` \| `1`        | Premium gratuito temporal                                                                                        |
| `NEXT_PUBLIC_PREMIUM_GRACE_PERIOD` | `0` \| `1`        | Idem, para cliente                                                                                               |
| `COOKIE_SECURE`                    | `true` \| `false` | Cookies solo HTTPS                                                                                               |
