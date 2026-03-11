# Planes Premium y roles

## Roles

| Rol                                 | Precio     | Descripción                                                                    |
| ----------------------------------- | ---------- | ------------------------------------------------------------------------------ |
| **BUYER** (Usuario)                 | 1 USD/mes  | Like y Favoritos únicamente                                                    |
| **AGENT** (Agente)                  | 3 USD/mes  | Listas personalizadas. Puede ser independiente o pertenecer a una inmobiliaria |
| **REALTOR** (Corredor inmobiliario) | 5 USD/mes  | Idem. Independiente o bajo inmobiliaria                                        |
| **INMOBILIARIA**                    | 10 USD/mes | Puede crear agentes/corredores bajo su organización (opcional)                 |

## Descuento por pertenecer a inmobiliaria

Agentes y corredores bajo una inmobiliaria tienen **20% de descuento** (cupón Stripe):

- Agente: 3 USD → 2,40 USD
- Corredor: 5 USD → 4 USD

## Variables de entorno Stripe

Crear en Stripe Dashboard un producto "MatchProp Premium" con precios mensuales:

- 1 USD (BUYER) → `STRIPE_PRICE_BUYER`
- 3 USD (AGENT) → `STRIPE_PRICE_AGENT`
- 5 USD (REALTOR) → `STRIPE_PRICE_REALTOR`
- 10 USD (INMOBILIARIA) → `STRIPE_PRICE_INMOBILIARIA`

Para el descuento 20%: crear cupón "20% off" en Stripe → `STRIPE_COUPON_ORG_20`.

Fallback: si no se definen precios por rol, se usa `STRIPE_PRICE_ID`.

## Sin premium activo

Si no se paga el mes correspondiente, el usuario pasa a **funciones free** con la opción de reactivar Premium cuando quiera (sugerencia persistente en la UI).

## Modal de perfil

Campos personales: nombre, apellido, mail (readonly), contraseña (cambio aparte), dni, matrícula, tel, wsp, telegram, twitter, ig, face, página web, domicilio.

Para inmobiliaria: nombre de la inmobiliaria, nombre comercial, domicilio inmobiliaria, tel, ws, y el resto de datos de contacto.
