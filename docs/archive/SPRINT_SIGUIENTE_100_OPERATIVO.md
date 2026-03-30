# Sprint siguiente — 100% operativo y listo para deploy

**Objetivo:** Alcanzar el nivel total de programación necesario para que, tras una revisión final, se pueda desplegar la app y quede **100% operativa y ajustada al proyecto sin faltantes**.

**Referencias:** masterplan.md, AUDITORIA_FULLSTACK.md, PROD.md, plan-completamiento-100.md.

---

## Resumen por etapas

| Etapa | Nombre                          | Entregable                                                                    |
| ----- | ------------------------------- | ----------------------------------------------------------------------------- |
| **1** | Cierre funcional y UX           | Todo el flujo usuario verificado; sin enlaces rotos; responsive OK            |
| **2** | Estabilidad y calidad           | Smoke E2E + typecheck + tests API verdes; PROD checklist y flags documentados |
| **3** | Monetización operativa          | Stripe B2C validado E2E; Wallet B2B planificado como siguiente hito           |
| **4** | Pre-producción y revisión final | Checklist revisión final; documento pre-deploy; app lista para deploy         |

---

## Etapa 1 — Cierre funcional y UX

**Objetivo:** Que no quede ningún hueco funcional ni de navegación para el usuario final.

### 1.1 Verificación flujo completo (comprador)

| #      | Tarea                         | Criterio de done                                                                                                                                     |
| ------ | ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1.1.1  | Login / registro              | Magic link, OAuth o Passkey operativos; redirect post-login a /feed o /dashboard                                                                     |
| 1.1.2  | Búsqueda activa               | ActiveSearchBar visible en feed, lista, assistant, searches, alerts; "Crear búsqueda" y "Cambiar" funcionan                                          |
| 1.1.3  | Asistente                     | 50 ejemplos visibles; parser texto→filtros; "Ver resultados ahora" aplica y persiste preferencias; botón voz OK                                      |
| 1.1.4  | Feed y lista                  | Swipe LIKE/NOPE; undo; lista con virtualización cuando >50 items; filtro por búsqueda activa                                                         |
| 1.1.5  | Favoritos y listas            | Guardar en favoritos; "Agregar a lista" con listas existentes y "Crear nueva lista"; modal unificado en feed, list, saved, listing, search, searches |
| 1.1.6  | Consultas (leads)             | "Quiero que me contacten" crea lead PENDING; activar (premium/admin) → ACTIVE; en ACTIVE: Chat, Agendar visita, Ver agenda                           |
| 1.1.7  | Chat                          | /leads/[id]/chat con burbujas, tema, enlace a agenda; solo si lead ACTIVE                                                                            |
| 1.1.8  | Agenda visitas                | /leads/[id]/visits con horarios sugeridos y datetime; /me/visits lista todas                                                                         |
| 1.1.9  | Búsquedas guardadas y alertas | /searches con CRUD; /searches/[id] con resultados y toggle alertas; /alerts lista suscripciones                                                      |
| 1.1.10 | Ficha de propiedad            | /listing/[id] con galería, datos, mapa si lat/lng, agregar a lista, "Quiero que me contacten", reverse matching si aplica                            |
| 1.1.11 | Configuraciones               | /me/settings con todas las secciones (Kiteprop, cargas JSON, CRM, API, pago, asistente, voz); enlace desde Perfil y sidebar                          |
| 1.1.12 | Premium                       | /me/premium con planes; checkout Stripe si configurado; HacersePremiumButton donde corresponda                                                       |

### 1.2 Navegación y enlaces

| #     | Tarea                | Criterio de done                                                                                               |
| ----- | -------------------- | -------------------------------------------------------------------------------------------------------------- |
| 1.2.1 | Sidebar y bottom nav | Enlaces a Match, Lista, Favoritos, Alertas, Búsquedas, Consultas, Perfil; Configuraciones y Premium en sidebar |
| 1.2.2 | Breadcrumbs / volver | En chat, visitas, detalle lead: "Consultas › Chat" (o similar) y botón volver a /leads                         |
| 1.2.3 | Sin 404 inesperados  | Todas las rutas públicas documentadas responden; rutas inexistentes con página 404 amigable                    |

### 1.3 Responsive y accesibilidad

| #     | Tarea          | Criterio de done                                                                                                       |
| ----- | -------------- | ---------------------------------------------------------------------------------------------------------------------- |
| 1.3.1 | Viewport móvil | Prueba en 320px y 375px; sin overflow horizontal; bottom nav usable                                                    |
| 1.3.2 | Contraste      | Textos críticos ("O crear nueva lista", "Enviar consulta", estados de consulta) con contraste suficiente (ya aplicado) |
| 1.3.3 | Formularios    | Labels asociados; focus visible en inputs y botones                                                                    |

### 1.4 Contenido y copy

| #     | Tarea             | Criterio de done                                                                                 |
| ----- | ----------------- | ------------------------------------------------------------------------------------------------ |
| 1.4.1 | Mensajes de error | Errores de API mostrados al usuario de forma clara (sin stack traces)                            |
| 1.4.2 | Empty states      | "Sin consultas", "Sin visitas", "Sin búsqueda activa" con CTA cuando aplique                     |
| 1.4.3 | Metadata SEO      | layout.tsx con title, description, keywords (ya aplicado); revisar que no falte en páginas clave |

**Entregable Etapa 1:** Lista de verificación 1.1–1.4 completada; incidencias anotadas y corregidas. Flujo comprador 100% usable.

---

## Etapa 2 — Estabilidad y calidad

**Objetivo:** Build y tests verdes; documentación de producción y feature flags clara.

### 2.1 Build y tests

| #     | Tarea            | Criterio de done                                                                                                                          |
| ----- | ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| 2.1.1 | Typecheck        | `pnpm -r typecheck` pasa en api, web, admin, shared                                                                                       |
| 2.1.2 | Tests API        | `pnpm --filter api test:all` pasa (auth, feed, searches, alerts, leads, integrations, ingest, etc.)                                       |
| 2.1.3 | Smoke E2E        | `pnpm smoke:ux` pasa (flujo login → assistant → guardar búsqueda → feed/list → consulta → leads); sin pageerror ni console.error críticos |
| 2.1.4 | Build producción | `pnpm build` (shared, api, web, admin) termina sin errores                                                                                |
| 2.1.5 | Lint             | `pnpm lint` sin errores bloqueantes                                                                                                       |

### 2.2 Documentación operativa

| #     | Tarea         | Criterio de done                                                                                                            |
| ----- | ------------- | --------------------------------------------------------------------------------------------------------------------------- |
| 2.2.1 | PROD.md       | Checklist pre-deploy completo; sección "Demo sources OFF"; variables de entorno API y Web listadas                          |
| 2.2.2 | Feature flags | FEATURE_FLAGS.md y PROD.md alineados: DEMO_MODE, KITEPROP_EXTERNALSITE_MODE, API_PARTNER_1; obligatorio DEMO_MODE=0 en prod |
| 2.2.3 | Migraciones   | deploy-pre.sh ejecutable; documentar que migraciones se aplican antes de start en prod                                      |
| 2.2.4 | Healthcheck   | GET /health con chequeo DB (200 ok, 503 si DB falla); documentado en PROD.md                                                |

### 2.3 Seguridad y no-reglas

| #     | Tarea              | Criterio de done                                                    |
| ----- | ------------------ | ------------------------------------------------------------------- |
| 2.3.1 | Sin PII en logs    | Revisar que logs no incluyan email, teléfono, nombre en texto plano |
| 2.3.2 | Funnel anti-cierre | Lead PENDING hasta activación; chat y visitas solo ACTIVE           |
| 2.3.3 | Anti-enumeración   | Magic link request siempre 200                                      |

**Entregable Etapa 2:** typecheck, test:all y smoke:ux verdes; PROD.md y feature flags listos para operación; healthcheck con DB.

---

## Etapa 3 — Monetización operativa

**Objetivo:** Stripe B2C listo para producción; Wallet B2B dejado planificado.

### 3.1 Stripe Premium B2C

| #     | Tarea          | Criterio de done                                                                                                  |
| ----- | -------------- | ----------------------------------------------------------------------------------------------------------------- |
| 3.1.1 | Variables      | STRIPE*SECRET_KEY, STRIPE_WEBHOOK_SECRET, STRIPE_PRICE*\* por rol (BUYER, AGENT, etc.) en .env.example y PROD.md  |
| 3.1.2 | Checkout       | POST /me/checkout-session crea sesión Stripe; redirect a Stripe Checkout; success/cancel URLs configuradas        |
| 3.1.3 | Webhook        | POST /webhooks/stripe verifica firma; checkout.session.completed actualiza User.premiumUntil                      |
| 3.1.4 | UI             | /me/premium muestra planes; HacersePremiumButton redirige a checkout; estado premium visible en perfil            |
| 3.1.5 | Validación E2E | (Manual o script) flujo: clic Suscribirme → Stripe Checkout → pago test → vuelta a app → premiumUntil actualizado |

### 3.2 Wallet B2B (siguiente hito)

| #     | Tarea            | Criterio de done                                                                                     |
| ----- | ---------------- | ---------------------------------------------------------------------------------------------------- |
| 3.2.1 | Documentar scope | En backlog o fase-4-monetizacion.md: modelo Wallet, débito por lead activado, rol INMOBILIARIA/AGENT |
| 3.2.2 | No bloqueante    | Etapa 3 se considera cerrada con Stripe B2C operativo; Wallet B2B como Epic aparte post-deploy       |

**Entregable Etapa 3:** Stripe B2C validado de punta a punta; PROD.md con validación "Monetización B2B/B2C"; Wallet B2B documentado para siguiente sprint.

---

## Etapa 4 — Pre-producción y revisión final

**Objetivo:** Checklist único de revisión final; app lista para deploy sin faltantes.

### 4.1 Checklist revisión final (pre-deploy)

Ejecutar y marcar antes de cada deploy a producción:

#### Entorno y configuración

- [ ] **DEMO_MODE=0** en API (obligatorio)
- [ ] **COOKIE_SECURE=true** en API
- [ ] **CORS_ORIGINS** con dominios de producción (sin localhost en prod)
- [ ] **APP_URL** y **API_PUBLIC_URL** con URLs reales
- [ ] **DATABASE_URL** apuntando a PostgreSQL de prod
- [ ] **JWT_SECRET** y **AUTH_REFRESH_SECRET** generados (no valores de dev)
- [ ] **INTEGRATIONS_MASTER_KEY** definido (Kiteprop)
- [ ] **KITEPROP_EXTERNALSITE_MODE** no es `fixture`
- [ ] **STRIPE_SECRET_KEY** y **STRIPE_WEBHOOK_SECRET** si se usa Premium B2C
- [ ] Ninguna variable **DEMO_LISTINGS_COUNT** o =0

#### Base de datos y migraciones

- [ ] Migraciones aplicadas: `pnpm run deploy:pre` (o equivalente en CI)
- [ ] Backup de DB previo al deploy (según política)

#### Build y tests

- [ ] `pnpm build` exitoso
- [ ] `pnpm -r typecheck` exitoso
- [ ] `pnpm --filter api test:all` exitoso
- [ ] `pnpm smoke:ux` exitoso (en entorno staging o con env de test)

#### Funcionalidad crítica

- [ ] Login/registro operativo
- [ ] Feed y lista cargan con búsqueda activa
- [ ] Crear consulta ("Quiero que me contacten") y ver en /leads
- [ ] Activar lead (premium o admin) y acceder a Chat y Agenda
- [ ] Healthcheck: GET /health devuelve 200 con db ok

#### Observabilidad

- [ ] Logs sin PII
- [ ] Healthcheck configurado en plataforma (Kubernetes, Railway, Fly.io, etc.)

### 4.2 Documento "Revisión final pre-deploy"

Crear o actualizar en el repo un archivo ejecutable por el equipo:

- **Ubicación sugerida:** `docs/REVISION_FINAL_PRE_DEPLOY.md`
- **Contenido:** Copia del checklist 4.1 con espacio para fecha, responsable y notas.
- **Uso:** Completar en cada release a producción; archivar (o commit con mensaje "Pre-deploy YYYY-MM-DD").

### 4.3 Script opcional de verificación

Opcional: script `scripts/pre-deploy-verify.sh` que ejecute:

- `pnpm build:shared && pnpm --filter api build && pnpm --filter web build`
- `pnpm -r typecheck`
- `pnpm --filter api test:all`
- Comprobar que existan variables requeridas en `.env` (solo en local; en CI no tener .env de prod)

No debe contener secretos; solo comprobaciones de build y tests.

**Entregable Etapa 4:** Checklist 4.1 documentado; REVISION_FINAL_PRE_DEPLOY.md creado; (opcional) script pre-deploy-verify.sh. App declarada lista para deploy.

---

## Orden de ejecución recomendado

1. **Etapa 1** — Cierre funcional y UX (verificación y correcciones).
2. **Etapa 2** — Estabilidad y calidad (tests, PROD, flags).
3. **Etapa 3** — Monetización Stripe B2C (validación E2E).
4. **Etapa 4** — Revisión final y checklist pre-deploy.

Al terminar las cuatro etapas y rellenar el checklist de revisión final, la app queda **100% operativa y ajustada al proyecto**, lista para deploy tras la revisión final.

**Plan de cierre concreto (pasos y estado actual):** [PLAN_DE_TRABAJO_CIERRE_VERSION.md](../PLAN_DE_TRABAJO_CIERRE_VERSION.md).

**Apertura beta (feedback usuarios):** [BETA_PROGRAMA_CIERRE_ETAPA.md](../BETA_PROGRAMA_CIERRE_ETAPA.md).

---

## Referencia rápida de documentos

| Documento                                                  | Uso                                                  |
| ---------------------------------------------------------- | ---------------------------------------------------- |
| [masterplan.md](../masterplan.md)                          | Epics, UX contract, non-negotiables                  |
| [PROD.md](../PROD.md)                                      | Checklist pre-deploy, variables, Docker, healthcheck |
| [AUDITORIA_FULLSTACK.md](./AUDITORIA_FULLSTACK.md)         | Estado actual, módulos, pendientes                   |
| [FEATURE_FLAGS.md](../FEATURE_FLAGS.md)                    | Flags por env                                        |
| [plan-completamiento-100.md](./plan-completamiento-100.md) | Fases 1–5 y resumen                                  |
| [repo-map.md](../repo-map.md)                              | Scripts, endpoints, tests                            |

---

**Última actualización:** Feb 2025 — Sprint siguiente 100% operativo.
