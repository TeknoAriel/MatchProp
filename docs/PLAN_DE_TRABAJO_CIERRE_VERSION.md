# Plan de trabajo — Cierre de esta versión

**Objetivo:** Ejecutar hasta el final del proyecto en esta versión, usando el plan ya definido y dejar la app lista para deploy y, si aplica, **beta pública**.

**Plan de referencia:** [SPRINT_SIGUIENTE_100_OPERATIVO.md](./archive/SPRINT_SIGUIENTE_100_OPERATIVO.md) (4 etapas).  
**Beta (feedback usuarios):** [BETA_PROGRAMA_CIERRE_ETAPA.md](./BETA_PROGRAMA_CIERRE_ETAPA.md).  
**Complementos:** [plan-completamiento-100.md](./plan-completamiento-100.md), [AUDITORIA_FULLSTACK.md](./AUDITORIA_FULLSTACK.md).

---

## ¿El plan está bien para continuar?

**Sí.** El plan vigente es **SPRINT_SIGUIENTE_100_OPERATIVO.md**:

| Etapa | Nombre                          | Entregable principal                                               |
| ----- | ------------------------------- | ------------------------------------------------------------------ |
| **1** | Cierre funcional y UX           | Flujo usuario completo; nav; 404; Configuraciones; responsive      |
| **2** | Estabilidad y calidad           | Typecheck, test:all, build, lint; PROD.md; healthcheck; deploy-pre |
| **3** | Monetización operativa          | Stripe B2C listo; Wallet B2B documentado (siguiente hito)          |
| **4** | Pre-producción y revisión final | Checklist pre-deploy; REVISION_FINAL_PRE_DEPLOY.md; script verify  |

**Alcance de “esta versión”:** Etapas 1–4 con Stripe B2C operativo. **Wallet B2B y Mercado Pago quedan para la siguiente versión** (ya documentados en fase-4-monetizacion.md).

---

## Fase 5 — Apertura a usuarios beta (post–etapa 4)

No es un sprint de código nuevo: es **operación y producto**.

| Paso | Documento / acción |
|------|-------------------|
| Definir alcance beta, URLs, canal de feedback | [BETA_PROGRAMA_CIERRE_ETAPA.md](./BETA_PROGRAMA_CIERRE_ETAPA.md) |
| Deploy estable + checklist env | [REVISION_FINAL_PRE_DEPLOY.md](./REVISION_FINAL_PRE_DEPLOY.md), [PROD.md](./PROD.md) |
| Franja “Versión beta” en la web (opcional) | `NEXT_PUBLIC_BETA=1` en `apps/web` (ver `.env.example`) |

---

## Estado actual por etapa

### Etapa 1 — Cierre funcional y UX ✅

| Ítem                                                                                                | Estado |
| --------------------------------------------------------------------------------------------------- | ------ |
| Login/registro, búsqueda activa, asistente (50 ejemplos, voz)                                       | ✅     |
| Feed/lista, favoritos/listas, consultas (leads), chat, agenda                                       | ✅     |
| Búsquedas guardadas y alertas, ficha propiedad, mapa en listing                                     | ✅     |
| **Configuraciones** (/me/settings): Kiteprop, cargas JSON, CRM, API universal, pago, asistente, voz | ✅     |
| Premium /me/premium, HacersePremiumButton                                                           | ✅     |
| Navegación (sidebar, bottom nav, breadcrumbs), 404 amigable                                         | ✅     |
| Responsive y empty states                                                                           | ✅     |

**Conclusión:** Etapa 1 cerrada.

---

### Etapa 2 — Estabilidad y calidad ✅

| Ítem                                                       | Estado                                            |
| ---------------------------------------------------------- | ------------------------------------------------- |
| `pnpm -r typecheck`                                        | ✅ Pasa                                           |
| `pnpm --filter api test:all`                               | ✅ Pasa (con DB levantada)                        |
| `pnpm --filter web build`                                  | ✅ Pasa (Suspense en páginas con useSearchParams) |
| `pnpm lint`                                                | ✅ Sin errores                                    |
| PROD.md (checklist, variables, demo off, healthcheck)      | ✅                                                |
| FEATURE_FLAGS.md y alineación con PROD                     | ✅                                                |
| deploy-pre.sh / `pnpm run deploy:pre`                      | ✅ Documentado y ejecutable                       |
| GET /health con chequeo DB (200/503)                       | ✅ Implementado y documentado                     |
| Seguridad (PII logs, funnel anti-cierre, anti-enumeración) | ✅ Documentado y cubierto en código               |

**Pendiente de ejecución (depende de entorno):**

- `pnpm smoke:ux` — requiere API + Web + DB levantados.
- `pnpm run pre-deploy:verify` — requiere **PostgreSQL en localhost:5432** para que test:all pase.

**Conclusión:** Etapa 2 cerrada a nivel de código y docs; faltan solo las verificaciones con servicios levantados.

---

### Etapa 3 — Monetización operativa ✅

| Ítem                                                                | Estado |
| ------------------------------------------------------------------- | ------ |
| Variables Stripe en .env.example y PROD.md (STRIPE\_\*)             | ✅     |
| POST /me/checkout-session, redirect Stripe Checkout                 | ✅     |
| POST /webhooks/stripe → premiumUntil                                | ✅     |
| UI /me/premium, HacersePremiumButton                                | ✅     |
| Wallet B2B documentado como siguiente hito (fase-4-monetizacion.md) | ✅     |

**Pendiente (manual, opcional para cerrar versión):**

- Validación E2E Stripe: configurar claves en .env, probar “Suscribirme” → Checkout → pago test → vuelta a app y comprobar premiumUntil.

**Conclusión:** Etapa 3 cerrada para esta versión; Stripe B2C listo; Wallet B2B fuera de alcance.

---

### Etapa 4 — Pre-producción y revisión final ✅

| Ítem                                                                          | Estado                             |
| ----------------------------------------------------------------------------- | ---------------------------------- |
| Checklist revisión final (4.1 en SPRINT_SIGUIENTE_100_OPERATIVO)              | ✅ En REVISION_FINAL_PRE_DEPLOY.md |
| Documento REVISION_FINAL_PRE_DEPLOY.md (fecha, responsable, ítems)            | ✅                                 |
| Script pre-deploy-verify.sh (build, typecheck, build api/web/admin, test:all) | ✅                                 |

**Conclusión:** Etapa 4 cerrada; solo falta **rellenar el checklist** en cada release real (fecha, responsable, marcar ítems).

---

## Secuencia para ejecutar hasta el final (esta versión)

### 1. Verificaciones automáticas (con DB levantada)

```bash
docker compose up -d
pnpm run deploy:pre
pnpm run pre-deploy:verify
```

### 2. Smoke E2E (recomendado antes de beta)

```bash
pnpm smoke:ux
```

### 3. Revisión final pre-deploy

- **docs/REVISION_FINAL_PRE_DEPLOY.md** — completar antes de cada deploy.

### 4. Beta pública

- Seguir **docs/BETA_PROGRAMA_CIERRE_ETAPA.md** (invitación, flujos a probar, canal de feedback).

---

## Resumen

| Qué                                  | Estado                                                                                                            |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------------------- |
| Plan a seguir                        | **archive/SPRINT_SIGUIENTE_100_OPERATIVO.md** (4 etapas)                                                         |
| Etapas 1–4 (código y documentación)  | **Completadas** para esta versión                                                                                 |
| Beta / feedback                      | **BETA_PROGRAMA_CIERRE_ETAPA.md** + `NEXT_PUBLIC_BETA` opcional                                                   |
| Fuera de esta versión                | Wallet B2B, Mercado Pago, Portal SEO, dashboards (documentados como siguientes hitos)                             |

---

**Última actualización:** Mar 2026 — Cierre de versión + fase beta.
