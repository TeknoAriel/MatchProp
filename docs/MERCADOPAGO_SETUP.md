# Configuración de Mercado Pago

Guía para integrar Mercado Pago como proveedor de pagos en MatchProp.

---

## 1. Crear cuenta en Mercado Pago Developers

1. Ir a [Mercado Pago Developers](https://www.mercadopago.com/developers/es)
2. Iniciar sesión con tu cuenta de Mercado Libre/Mercado Pago
3. Crear una aplicación en el Dashboard

---

## 2. Obtener credenciales

### Para desarrollo (Sandbox)

En el Dashboard de tu aplicación:

- **Public Key**: Se usa en el frontend (no sensible)
- **Access Token de prueba**: Para transacciones de prueba

### Para producción

1. Completar la verificación de tu cuenta
2. Obtener las credenciales de producción:
   - **Public Key de producción**
   - **Access Token de producción**

---

## 3. Variables de entorno

Agregar en Vercel (o `.env` local):

```env
# Mercado Pago
MERCADOPAGO_ACCESS_TOKEN=APP_USR-xxx...xxx     # Access Token (sandbox o producción)
MERCADOPAGO_PUBLIC_KEY=APP_USR-xxx...xxx       # Public Key
MERCADOPAGO_WEBHOOK_SECRET=xxx                  # Opcional: para verificar webhooks

# URLs (automáticas en Vercel, configurar en local)
FRONTEND_URL=https://matchprop.vercel.app
API_URL=https://matchprop-api.vercel.app
```

### Sandbox vs Producción

- **Sandbox** (pruebas): Usar credenciales de prueba. Los pagos son simulados.
- **Producción**: Usar credenciales de producción. Los pagos son reales.

Para cambiar entre modos, solo cambiá las credenciales en las variables de entorno.

---

## 4. Configurar Webhooks (IPN)

1. En el Dashboard de MP, ir a **Integraciones > Webhooks**
2. Agregar webhook con URL:
   ```
   https://matchprop-api.vercel.app/payments/webhook/mp
   ```
3. Seleccionar eventos: **payment**
4. Copiar el **Webhook Secret** y agregarlo como `MERCADOPAGO_WEBHOOK_SECRET`

---

## 5. Flujo de pago

```
Usuario → [Elegir plan] → [Checkout MP] → [Pago en MP] → [Webhook] → [Activar Premium]
```

1. Usuario selecciona plan en `/me/premium`
2. Click en "Suscribirme" lleva a `/me/checkout`
3. Se crea preferencia de pago y se redirige a Mercado Pago
4. Usuario paga (o simula pago en sandbox)
5. MP envía webhook a nuestra API
6. API activa la suscripción y actualiza el usuario

---

## 6. Probar con usuarios de prueba

Mercado Pago provee usuarios de prueba para sandbox:

1. En Dashboard > Credenciales de prueba > Crear usuario de prueba
2. Usar ese usuario para simular compras
3. Tarjetas de prueba disponibles en [documentación MP](https://www.mercadopago.com.ar/developers/es/docs/checkout-pro/additional-content/your-integrations/test/cards)

### Tarjetas de prueba comunes (Argentina)

| Tarjeta             | Número              | CVV | Vencimiento |
| ------------------- | ------------------- | --- | ----------- |
| Mastercard aprobada | 5031 7557 3453 0604 | 123 | 11/25       |
| Visa aprobada       | 4509 9535 6623 3704 | 123 | 11/25       |
| Tarjeta rechazada   | 4000 0000 0000 0002 | 123 | 11/25       |

---

## 7. Endpoints de la API

### `GET /payments/config`

Retorna configuración de proveedores (público).

```json
{
  "providers": {
    "mercadopago": { "enabled": true, "publicKey": "APP_USR-..." },
    "stripe": { "enabled": false, "publicKey": null }
  },
  "defaultProvider": "MERCADO_PAGO",
  "currency": "ARS"
}
```

### `POST /payments/checkout`

Crea sesión de checkout (requiere auth).

```json
// Request
{
  "plan": "AGENT",
  "billingCycle": "monthly",
  "provider": "MERCADO_PAGO"
}

// Response
{
  "checkoutUrl": "https://www.mercadopago.com.ar/checkout/v1/redirect?pref_id=...",
  "provider": "MERCADO_PAGO",
  "preferenceId": "123456789-abc..."
}
```

### `POST /payments/webhook/mp`

Recibe notificaciones de Mercado Pago (IPN).

---

## 8. Monitoreo

### Ver pagos en el Dashboard de MP

- Dashboard > Ventas > Ver pagos

### Ver en nuestra base de datos

```sql
SELECT * FROM "Payment" WHERE provider = 'MERCADO_PAGO' ORDER BY "createdAt" DESC;
SELECT * FROM "Subscription" WHERE provider = 'MERCADO_PAGO' ORDER BY "createdAt" DESC;
```

### Logs de webhooks

Los webhooks se loguean en Vercel Functions logs.

---

## 9. Precios y tipo de cambio

Actualmente usamos un tipo de cambio fijo:

- `USD_TO_ARS = 1000` (en `/routes/payments.ts`)

**Recomendación**: Implementar un job para actualizar el tipo de cambio diariamente usando una API como [DolarApi](https://dolarapi.com/).

---

## 10. Troubleshooting

### El webhook no llega

1. Verificar que la URL del webhook sea correcta
2. Verificar que el webhook esté activo en el Dashboard de MP
3. Revisar logs en Vercel

### Pago aprobado pero usuario no tiene premium

1. Verificar que el webhook se procesó (`Payment.status = 'COMPLETED'`)
2. Verificar que la suscripción se activó (`Subscription.status = 'ACTIVE'`)
3. Si no, revisar logs del webhook

### Error "Mercado Pago no está configurado"

- Verificar que `MERCADOPAGO_ACCESS_TOKEN` esté en las variables de entorno

---

## Referencias

- [Documentación Checkout Pro](https://www.mercadopago.com.ar/developers/es/docs/checkout-pro/landing)
- [API de Pagos](https://www.mercadopago.com.ar/developers/es/reference/payments/_payments/get)
- [Webhooks (IPN)](https://www.mercadopago.com.ar/developers/es/docs/your-integrations/notifications/webhooks)
