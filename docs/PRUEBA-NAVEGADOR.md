# Prueba real en navegador

Guía para probar MatchProp end-to-end en el navegador.

---

## 1. Levantar el entorno

```bash
pnpm dev:up
```

Esto levanta:

- **API** en http://localhost:3001
- **Web** en http://localhost:3000
- **PostgreSQL** (Docker)
- Seed demo con datos de prueba

Al terminar, se abre automáticamente http://localhost:3000/login (en macOS).

---

## 2. Variables de entorno para Stripe (Premium)

Para probar el flujo Premium con Stripe, configurá en `apps/api/.env`:

| Variable                | Descripción                                                   |
| ----------------------- | ------------------------------------------------------------- |
| `STRIPE_SECRET_KEY`     | Clave secreta de Stripe (empieza con `sk_test_` en modo test) |
| `STRIPE_WEBHOOK_SECRET` | Secret del webhook (empieza con `whsec_`)                     |
| `STRIPE_PRICE_ID`       | ID del precio de suscripción (ej. `price_xxx`)                |
| `APP_URL`               | URL de la app (default `http://localhost:3000`)               |

**Stripe en modo test:**

1. Creá cuenta en https://dashboard.stripe.com
2. Activate el modo Test (toggle arriba a la derecha)
3. En Products → creá producto "Premium" con precio recurrente mensual
4. Copiá el Price ID
5. En Developers → Webhooks → Add endpoint:
   - URL: `https://tu-ngrok-url/webhooks/stripe` (para pruebas locales usá ngrok o Stripe CLI)
   - Eventos: `checkout.session.completed`

**Webhook local con Stripe CLI:**

```bash
stripe listen --forward-to localhost:3001/webhooks/stripe
```

Te dará un `whsec_xxx` para `STRIPE_WEBHOOK_SECRET`.

---

## 3. Checklist de prueba

### Auth y navegación

- [ ] Login con magic link (email smoke-ux@matchprop.com o demo@matchprop.com)
- [ ] Navegación: Match, Listas favoritas, Visitas, Consultas, Notificaciones, Premium

### Feed y búsqueda

- [ ] Feed muestra cards de inmuebles
- [ ] Swipe Like/Nope funciona
- [ ] Búsqueda manual retorna resultados
- [ ] Crear búsqueda guardada

### Consultas (Leads)

- [ ] Crear consulta desde feed ("Quiero que me contacten")
- [ ] Ver lista de consultas en /leads
- [ ] Si NO sos premium: ver botón "Hacerse Premium" en leads PENDING
- [ ] Si sos premium: botón "Activar ahora" en leads PENDING

### Premium (requiere Stripe configurado)

- [ ] Ir a /me/premium
- [ ] Click "Suscribirme a Premium" → redirige a Stripe Checkout
- [ ] Completar pago con tarjeta test `4242 4242 4242 4242`
- [ ] Vuelta a /feed?premium=ok
- [ ] Verificar premiumUntil en /me o /leads (poder activar leads)

### Wallet B2B (inmobiliarias)

Requiere sesión de usuario con org (agent/owner). Por API:

- [ ] `GET /orgs/:orgId/wallet` — ver wallet
- [ ] `POST /orgs/:orgId/wallet/top-up` — recargar (body: `{ amountCents: 1000 }`)
- [ ] `POST /orgs/:orgId/leads/:leadId/activate` — activar lead pagando con wallet

---

## 4. Usuarios demo

| Email                  | Rol   | Notas                                          |
| ---------------------- | ----- | ---------------------------------------------- |
| smoke-ux@matchprop.com | BUYER | Tiene premiumUntil en seed (activar lead demo) |
| demo@matchprop.com     | BUYER | Usuario demo estándar                          |

Para magic link: en /login ingresar email → click "Abrir link de acceso dev" (en dev el link se muestra en consola o en la respuesta).

---

## 5. Comandos útiles

```bash
# Solo API
pnpm dev:api

# Solo Web
pnpm dev:web

# Typecheck
pnpm -r typecheck

# Smoke E2E
pnpm smoke:ux
```

---

## 6. Troubleshooting

- **401 en /api/me**: No hay sesión. Hacé login de nuevo.
- **501 en /me/checkout-session**: STRIPE_SECRET_KEY no configurado.
- **Webhook no actualiza premiumUntil**: Verificá STRIPE_WEBHOOK_SECRET y que el webhook llegue al API (ngrok o Stripe CLI).
- **CORS**: El proxy /api → 3001 evita CORS. Si usás API directo, agregá localhost:3000 a CORS_ORIGINS.
