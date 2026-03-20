# Verificación de conexiones — MatchProp (repo único)

Repositorio: **MatchProp** (monorepo pnpm). Apps: `apps/web`, `apps/api`, `apps/admin`, `apps/mobile`, `packages/shared`.

---

## 1) Estructura del repo y deploys

| App   | Ruta en repo | Deploy Vercel (ejemplo)          | Qué hace                                                                                                                         |
| ----- | ------------ | -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Web   | `apps/web`   | match-prop-web.vercel.app        | Next.js; login, feed, listas, búsqueda, configuraciones. Todas las llamadas al backend pasan por `/api/*` → reescritas a la API. |
| API   | `apps/api`   | match-prop-admin-dsvv.vercel.app | Fastify en serverless (`api/[[...path]].ts`). Salud, auth, feed, listas, leads, asistente, integraciones, etc.                   |
| Admin | `apps/admin` | (opcional) otro proyecto Vercel  | Next.js puerto 3002; panel interno. No es el mismo que "Configuraciones" de la web.                                              |

**Confirmación:** Un solo repo. No hay que conectar “otro repo”; todo está en este.

---

## 2) Conexión Web → API (la crítica)

- **En el navegador:** La web hace `fetch('/api/...', { credentials: 'include' })`. La URL es siempre el mismo origen (ej. `match-prop-web.vercel.app`).
- **En el servidor Next (Vercel):** `next.config.ts` tiene un **rewrite**:  
  `source: '/api/:path*'` → `destination: '${API_SERVER_URL}/:path*'`.
- **API_SERVER_URL** debe ser la URL pública de la API, ej. `https://match-prop-admin-dsvv.vercel.app`.

**Variables en el proyecto Web (Vercel):**

| Variable              | Valor                                      | Obligatorio                                               |
| --------------------- | ------------------------------------------ | --------------------------------------------------------- |
| `API_SERVER_URL`      | `https://match-prop-admin-dsvv.vercel.app` | **Sí** (o la URL real de tu API)                          |
| `NEXT_PUBLIC_API_URL` | Mismo valor                                | Opcional (solo si el cliente usa esta URL en algún sitio) |

Si `API_SERVER_URL` no está definida, `next.config.ts` usa un fallback cuando `VERCEL === '1'` a esa URL. Aun así, **conviene definirla** en el dashboard de Vercel (proyecto Web) para no depender del fallback y poder cambiarla sin rebuild.

**Comprobación rápida:** En el navegador, en la pestaña Red, al abrir Configuraciones o al buscar: la petición debe ser a `https://match-prop-web.vercel.app/api/me/profile` (o `/api/assistant/search`, etc.) y la **respuesta** debe venir con status 200/401/403, no 404. Si ves 404, la petición no está llegando a la API (rewrite o URL incorrecta).

---

## 3) Subconexiones que usa la Web (todas vía `/api/*`)

Todas estas rutas son **relativas al origen** (`/api/...`), por tanto las sirve el **mismo deploy de la web** y el servidor Next las reescribe a la API.

| Funcionalidad           | Rutas API que usa                                                         | Si falla (404/red)                                 |
| ----------------------- | ------------------------------------------------------------------------- | -------------------------------------------------- |
| Login (password)        | `POST /login`                                                             | "Credenciales inválidas" o error de red            |
| Perfil / rol            | `GET /me/profile`                                                         | Menú de Configuraciones vacío o sin opciones admin |
| Listas (agregar, crear) | `GET /me/lists`, `POST /me/lists`, `POST /me/lists/:id/items`             | "Error al agregar" / no permite guardar lista      |
| Búsqueda por asistente  | `POST /assistant/search`, `POST /assistant/preview`                       | Error 404 en buscar                                |
| Feed / listado          | `GET /feed`, `GET /status/listings-count`                                 | Listado vacío o error                              |
| Alertas                 | `GET /alerts/subscriptions`, `POST /alerts/subscriptions`                 | Alerta "sin conexión API"                          |
| Config integraciones    | `GET/PUT /integrations/importers`, `GET/PUT /integrations/kiteprop`, etc. | Páginas de config no cargan o 403                  |

Todas dependen de que **el rewrite Web → API funcione** y de que la **API** tenga el path correcto (el handler Vercel `api/[[...path]].ts` recibe el path y lo pasa a Fastify).

---

## 4) API (proyecto match-prop-api-1jte)

- **Entrada:** Cualquier request a `https://match-prop-admin-dsvv.vercel.app/XXX` se reescribe a ` /api/XXX` y lo atiende `api/[[...path]].ts`.
- **Dentro del handler:** Se construye el path para Fastify (sin el prefijo `/api`) y se hace `app.inject({ method, url: path, headers, payload })`. Las rutas de Fastify están registradas **sin** prefijo `/api` (ej. `GET /me/profile`, `POST /assistant/search`).
- **Autenticación:** Cookie `access_token` o header `Authorization: Bearer <token>`. Si el request viene de la web por rewrite, Next/Vercel reenvía las cookies.

**Comprobación directa a la API (sin pasar por la web):**

```bash
# Sin auth (debe dar 401 en rutas protegidas)
curl -s -o /dev/null -w "%{http_code}" https://match-prop-admin-dsvv.vercel.app/me/profile
# Esperado: 401

# Con login
curl -s -c cookies.txt -X POST https://match-prop-admin-dsvv.vercel.app/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"ariel@kiteprop.com","password":"KiteProp123"}'
# Esperado: 200 y body con token

curl -s -b cookies.txt https://match-prop-admin-dsvv.vercel.app/me/profile
# Esperado: 200 y body con role, email, etc.
```

Si esto da 200 con cookies y desde la web da 404, el fallo está en la **conexión Web → API** (rewrite o variable de entorno).

**Diagnóstico desde la web:** Abrí `/status` en la app. Ahí se llama a `GET /api/status/connect`; si la API responde, verás el `path` que recibió (confirma que el rewrite está llegando bien). Si ves 404, el header `X-MatchProp-Path` (si existe) indica qué path usó el handler.

---

## 5) Checklist punto por punto

- [ ] **Repo:** Es este (MatchProp). Una sola codebase.
- [ ] **Vercel – Proyecto Web:** Root = `apps/web`. Variable `API_SERVER_URL` = `https://match-prop-admin-dsvv.vercel.app` (o la URL real de la API).
- [ ] **Vercel – Proyecto API:** Root = `apps/api`. Build correcto (Prisma generate + build). Sin variables que rompan el build.
- [ ] **Navegador:** Al usar la web, las peticiones en la pestaña Red son a `match-prop-web.vercel.app/api/...` y las respuestas no son 404 (p. ej. 200, 401, 403).
- [ ] **Menú Configuraciones:** Si `/api/me/profile` falla, la página puede mostrar el menú igual (cambio en código) para que los admin vean las opciones; el backend seguirá devolviendo 403 a no-admin en cada integración.
- [ ] **Listas y búsqueda:** Misma condición: que `/api/me/lists`, `/api/assistant/search`, etc. lleguen a la API. No hay “subrepos”; todo es este repo y la misma API.

---

## 6) Resumen de causas típicas de los 3 problemas

| Problema                                      | Causa más probable                                                         | Qué revisar                                                                                        |
| --------------------------------------------- | -------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| No muestra el menú de configuración           | `GET /api/me/profile` devuelve 404 o no se ejecuta                         | Variable `API_SERVER_URL` en proyecto Web; que el rewrite apunte a la API correcta.                |
| No permite guardar lista / "Error al agregar" | `POST /api/me/lists` o `POST /api/me/lists/:id/items` devuelve 404 o error | Igual: conexión Web → API; en Red del navegador ver status y body de esa petición.                 |
| Error 404 en buscar                           | `POST /api/assistant/search` devuelve 404                                  | Misma conexión; comprobar que la API recibe POST en `/assistant/search` (path que usa el handler). |

No hay “repos incorrectos”: es un tema de **que la web en producción esté reenviando correctamente cada `/api/*` a la URL base de la API** y de que la API esté desplegada y respondiendo.

---

## 7) Lead a Kiteprop (mensaje por defecto)

El payload que se envía a Kiteprop incluye por defecto un mensaje con este formato:

`Consulta desde MatchProp sobre propiedad [título] de [fuente/editor]. Tel: [teléfono]. Mail: [email].`

- El teléfono se toma del perfil del usuario (UserProfile.phone o whatsapp) si existe.
- La “fuente” es el source del listing o el displayName del publisher.
- Si no hay template personalizado en la integración Kiteprop, se usa este mensaje.
