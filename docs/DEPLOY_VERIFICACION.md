# Verificación post-deploy (producción)

## 1. Variables en Vercel – Proyecto **API**

En **Settings → Environment Variables** del proyecto API:

| Variable              | Valor                               | Notas                       |
| --------------------- | ----------------------------------- | --------------------------- |
| `DATABASE_URL`        | `postgresql://...`                  | Neon u otro Postgres        |
| `JWT_SECRET`          | string largo y aleatorio            | Mismo en todos los entornos |
| `AUTH_REFRESH_SECRET` | string largo                        |                             |
| `APP_URL`             | `https://match-prop-web.vercel.app` | URL de la Web               |
| `CORS_ORIGINS`        | `https://match-prop-web.vercel.app` | Origen de la Web            |
| `API_SERVER_URL`      | (opcional en API)                   |                             |
| `COOKIE_SECURE`       | `true`                              | En producción               |

## 2. Variables en Vercel – Proyecto **Web**

| Variable         | Valor                                                                        |
| ---------------- | ---------------------------------------------------------------------------- |
| `API_SERVER_URL` | `https://match-prop-api-1jte.vercel.app` (o la URL real de tu API en Vercel) |

## 3. Login admin (email + contraseña)

- **URL:** https://match-prop-web.vercel.app/login
- **Emails:** `ariel@kiteprop.com`, `jonas@kiteprop.com`, `soporte@kiteprop.com` (no importa mayúsculas/minúsculas).
- **Contraseña:** `KiteProp123` (tal cual, sin espacios).
- Si antes entraste por **demo** o **magic link**, la primera vez que uses email + esa contraseña se actualiza la cuenta y podés entrar como admin.

## 4. Búsqueda (assistant)

- Entrá al asistente/buscador y probá por ejemplo: **"Departamento 3 ambientes en venta, Belgrano"**.
- Si ves **404**: el path no está llegando bien a la API; el fix en `api/[[...path]].ts` (usar `query.path`) debería corregirlo.
- Si ves **401**: volvé a iniciar sesión (magic link o email + contraseña).

## 5. Configurar APIs (Kiteprop, etc.)

- Una vez logueado como admin, ir a **Ajustes** (o **Configurar IA y voz** / integraciones).
- Ahí podés configurar el JSON de propiedades y las APIs para pruebas reales.

## 6. Si algo falla

- **Credenciales inválidas:** revisar que el email sea exactamente uno de los tres y la contraseña `KiteProp123`.
- **Error al buscar (404):** confirmar que el último deploy de la API incluye el cambio en `api/[[...path]].ts` (path desde `query.path`).
- **Error 502/503:** revisar logs del proyecto API en Vercel y que `DATABASE_URL` y migraciones estén bien.
