# Programa beta — Cierre de etapa y feedback

**Objetivo:** Dar por **cerrada la etapa de desarrollo interno** (sprints definidos para “versión desplegable”), abrir la app a **usuarios beta** y recopilar devoluciones accionables.

**Estado del plan:** Las etapas 1–4 de [SPRINT_SIGUIENTE_100_OPERATIVO.md](./archive/SPRINT_SIGUIENTE_100_OPERATIVO.md) se consideran **cerradas en código y documentación**. Lo que sigue es **operación**: deploy estable, variables de entorno de producción, invitación a beta y canal de feedback.

---

## 1. Qué sprints / etapas quedan cerradas con esta fase

| Bloque | Documento | Significado “cerrado” |
|--------|-----------|------------------------|
| **Etapas 1–4** (UX, calidad, Stripe B2C, pre-deploy) | [archive/SPRINT_SIGUIENTE_100_OPERATIVO.md](./archive/SPRINT_SIGUIENTE_100_OPERATIVO.md) | Producto usable end-to-end; gates técnicos documentados (`pre-deploy:verify`, `smoke:ux`, `REVISION_FINAL_PRE_DEPLOY.md`). |
| **Alineación masterplan (core)** | `masterplan.md`, `AUDITORIA_FULLSTACK.md` | E1–E6 y gran parte de E7/E8 operativos; pendientes explícitos solo en backlog (Wallet B2B, Mercado Pago, SEO amplio, dashboards). |

**No forma parte de este cierre (siguiente oleada de producto):**

- Wallet B2B completo (balance, top-up, UI wallet).
- Adapter Mercado Pago (E7).
- Portal SEO / analytics avanzados.
- Feature flags con UI administrable.

Quedan documentados en [fase-4-monetizacion.md](./fase-4-monetizacion.md) y [TAREAS_Y_MEJORAS.md](./TAREAS_Y_MEJORAS.md) (si aplica).

---

## 2. Checklist operativo antes de invitar beta

Ejecutar en el entorno que usarán los beta (staging o producción):

1. **Base de datos:** migraciones aplicadas (`pnpm run deploy:pre` o equivalente en CI).
2. **Producción segura:** revisar [PROD.md](./PROD.md) y [REVISION_FINAL_PRE_DEPLOY.md](./REVISION_FINAL_PRE_DEPLOY.md) (DEMO_MODE, CORS, secretos, healthcheck).
3. **Build y tests (local/CI con DB):** `pnpm run pre-deploy:verify`.
4. **Smoke E2E (recomendado):** `pnpm smoke:ux` con API + Web + DB de prueba.
5. **Web beta (opcional):** en Vercel (o similar), definir `NEXT_PUBLIC_BETA=1` para mostrar la franja “Versión beta” en la app (ver `.env.example` en `apps/web`).

---

## 3. Acceso para usuarios beta

**URL beta (web + móvil PWA):** [https://matchprop.beta.vercel.app](https://matchprop.beta.vercel.app)

**URLs y configuración:**

- **App web:** prioridad a `NEXT_PUBLIC_APP_URL` en Vercel; fallback de desarrollo documentado en `apps/web` apunta a la beta anterior.
- **API:** debe coincidir con el proxy de Next (`API_SERVER_URL` / rewrites) y con `API_PUBLIC_URL` en la API.

**Registro / login:**

- Magic link, OAuth o passkey según [auth-v2.md](./auth-v2.md).
- En entornos de demo local se usa `smoke-ux@matchprop.com` y “link de acceso dev”; **en beta pública** los testers deben usar **su email real** y el flujo de magic link u OAuth configurado en prod.

**API (catálogo):** opcional `FEED_MAX_LISTING_AGE_YEARS` (default 4). El feed aplica la misma ventana y exige señal visual (fotos, media en BD o hero). Tras ingest manual: `pnpm --filter api listing:prune-stale` para marcar INACTIVE lo que ya no califica.

### Guion de invitación (correo o mensaje)

> Hola, [nombre],
>
> Estamos abriendo **MatchProp** a un grupo reducido de personas para probar la app en condiciones reales antes del lanzamiento amplio.
>
> **Tu acceso:** [https://matchprop.beta.vercel.app](https://matchprop.beta.vercel.app) — funciona en **celular** (navegador o “Agregar a inicio”) y en **computadora**.
>
> Te pedimos que recorras lo que más te resulte natural (buscar propiedades, guardar favoritos, pedir contacto si aplica) y nos cuentes **qué funcionó bien y qué no** [indicar aquí el canal: formulario / email / GitHub].
>
> Es una **versión beta**: puede haber cambios y correcciones según el feedback. Gracias por ayudarnos a mejorarla.
>
> [Firma / equipo]

---

## 4. Qué pedirles que prueben (prioridad para feedback)

Orden sugerido para maximizar señal:

1. **Onboarding:** crear cuenta, primera sesión, claridad de pantallas.
2. **Búsqueda activa + feed/lista:** crear o elegir búsqueda, ver resultados, swipe o lista.
3. **Asistente:** texto y, si pueden, voz; “Ver resultados” y guardar búsqueda.
4. **Guardados y listas:** favoritos, listas personalizadas.
5. **Consulta (“Quiero que me contacten”)** y **/leads** (estados PENDING / ACTIVE si tienen premium o rol adecuado).
6. **Chat y visitas** (solo si el lead está ACTIVE).
7. **Premium** (si Stripe está configurado): flujo hasta checkout de prueba.
8. **Configuraciones** (`/me/settings`): si son perfiles técnicos o agencias.

---

## 5. Cómo nos devuelven feedback (definir y comunicar)

Elegir **un canal único** y publicarlo en el mail de invitación:

- **Issues en GitHub** (repo privado o público con plantilla “Beta feedback”).
- **Formulario** (Google Forms, Typeform, etc.).
- **Email** dedicado (ej. `beta@tudominio.com`).

Plantilla mínima que les pedís:

- Qué estabas haciendo (pantalla / flujo).
- Qué esperabas vs qué pasó.
- Navegador y dispositivo (móvil / desktop).
- Captura de pantalla o video (opcional).

---

## 6. Transparencia con los beta

- Indicar que es **versión beta**: pueden haber cambios, bugs corregidos en caliente.
- Si hay datos de demostración o listings de prueba, aclararlo.
- Política de datos personales según tu aviso de privacidad (no sustituye asesoría legal).

---

## 7. Después del beta

- Priorizar issues por severidad e impacto (bloqueantes vs mejoras).
- Reabrir o crear tareas en [TAREAS_Y_MEJORAS.md](./TAREAS_Y_MEJORAS.md) / backlog.
- Cuando la oleada beta cierre, se puede **apagar** `NEXT_PUBLIC_BETA` o pasar a “release candidate”.

---

## Referencias

| Documento | Uso |
|-----------|-----|
| [PLAN_DE_TRABAJO_CIERRE_VERSION.md](./PLAN_DE_TRABAJO_CIERRE_VERSION.md) | Cierre técnico de versión y comandos de verificación |
| [REVISION_FINAL_PRE_DEPLOY.md](./REVISION_FINAL_PRE_DEPLOY.md) | Checklist antes de cada deploy |
| [PROD.md](./PROD.md) | Variables y demo off |
| [PRUEBA-NAVEGADOR.md](./PRUEBA-NAVEGADOR.md) | Escenarios manuales detallados |

---

**Última actualización:** Mar 2026 — Cierre de etapa orientado a beta pública.
