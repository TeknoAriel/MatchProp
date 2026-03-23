# Webhooks: respuestas a consultas (genérico + Kiteprop)

MatchProp expone endpoints **públicos** (sin JWT de usuario) para que un CRM o Kiteprop registre la **respuesta de la inmobiliaria** como mensaje `PUBLISHER` en el lead correspondiente.

## Autenticación

Variable de entorno: **`WEBHOOK_INBOUND_SECRET`**.

En cada request, enviar el mismo valor en **uno** de estos:

- Header: `X-Matchprop-Webhook-Secret: <secret>`
- O header: `Authorization: Bearer <secret>`

Si `WEBHOOK_INBOUND_SECRET` está vacío, los endpoints responden **503** (no configurado).

## URLs

| Método | Ruta | Uso |
|--------|------|-----|
| `POST` | `/webhooks/inbound` | Formato genérico; también acepta el mismo cuerpo que el parser Kiteprop. |
| `POST` | `/webhooks/kiteprop/reply` | Solo el parser **adaptado a Kiteprop** (campos típicos abajo). |

Base URL: `API_PUBLIC_URL` (ej. `https://api.tu-dominio.com`).

## Cuerpo genérico (`/webhooks/inbound`)

Mínimo:

- `leadId` **o** `matchprop_lead_id` — ID del lead en MatchProp (cuid).
- Texto en uno de: `message`, `body`, `reply`, `text`.

Ejemplo:

```json
{
  "leadId": "clxxx...",
  "message": "Hola, te paso horarios para la visita."
}
```

En el envío de consulta hacia Kiteprop (callback Yumblin) el cuerpo del mensaje del usuario incluye una línea de referencia:

`[MatchProp leadId: <id>]`

Así Kiteprop puede devolver el mismo `leadId` en el webhook.

## Cuerpo adaptado Kiteprop (`/webhooks/kiteprop/reply` o parser mixto en `/webhooks/inbound`)

Se aceptan variantes de nombres de campo:

| Lead ID | Campo texto |
|---------|-------------|
| `matchprop_lead_id`, `lead_id`, `leadId`, `matchpropLeadId` | `body`, `message`, `reply`, `reply_text` |

Ejemplo:

```json
{
  "matchprop_lead_id": "clxxx...",
  "body": "¡Hola! Podemos coordinar el viernes a las 15."
}
```

## Respuesta exitosa

```json
{ "ok": true, "messageId": "..." }
```

Errores: **400** (payload inválido o lead inexistente), **401** (secreto incorrecto).

## Notificación al usuario

Se crea una notificación tipo **`LEAD_REPLY`** y un mensaje en el chat del lead con `senderType: PUBLISHER`.

---

## Push de prueba a Kiteprop (Yumblin)

Para pruebas manuales, el callback documentado por Kiteprop:

`POST https://www.kiteprop.com/difusions/messages/callback/yumblin`

Con JSON: `name`, `email`, `phone`, `property_id`, `body`.

En MatchProp, con **`ENABLE_YUMBLIN_TEST_PUSH=1`** en la API:

- `POST /leads/:id/push-yumblin-test` (usuario autenticado, dueño del lead).
- Siempre envía `property_id: "34"` (propiedad de prueba) y completa el resto con perfil + texto de la consulta + referencia `leadId`.

En la web, **`NEXT_PUBLIC_ENABLE_YUMBLIN_TEST_PUSH=1`** muestra el botón temporal **«Push prueba Kiteprop»** en Mis consultas.
