# Demo — Prueba real solo con navegador

**Objetivo:** que cualquiera pueda probar MatchProp “como app real” en ~2 minutos, solo con clicks, sin ejecutar comandos.

---

## Requisitos

- Entorno levantado con `pnpm start` (o `pnpm dev:up`).
- **DEMO_MODE=1** (por defecto en dev; en prod debe ser 0).
- Usuario con sesión (login por magic link o demo).

---

## 5 pasos de prueba (solo navegador)

1. **Iniciar sesión**  
   Ir a `/login`, ingresar email (ej. `smoke-ux@matchprop.com` en dev), usar el “Abrir link de acceso (dev)” para entrar al dashboard.

2. **Crear escenario demo**  
   Ir a `/demo`. Si la demo está habilitada, hacer click en **“Crear escenario demo”**. La página mostrará links a: búsqueda guardada, mis consultas, chat del lead, agenda, feed lista.

3. **Revisar lead ACTIVE**  
   Ir a **Mis consultas** (`/leads`). Debe aparecer un lead en estado **ACTIVE** (badge verde). Desde ahí se puede abrir **Chat** y **Agendar visita**.

4. **Ver chat y mensaje bloqueado**  
   Entrar al **Chat** del lead (link “Chat del lead” o desde la card en `/leads`). Debe verse un mensaje normal (“Hola, quiero coordinar visita”) y otro con **[BLOCKED]** o texto “bloqueado” (email/URL bloqueados por anti-PII).

5. **Ver agenda y feed**  
   En **Agenda** (`/leads/:id/visits`) debe haber una visita programada (mañana 10:00). En **Feed lista** (`/feed/list`) se ven cards con fotos (SVGs demo) y se puede usar “Quiero que me contacten”. El feed está filtrado por la búsqueda activa (barra arriba).

6. **Alertas y búsqueda activa**  
   En **Búsquedas guardadas** (`/searches`) entrá a una búsqueda. En la sección **Alertas** activá “Nuevas publicaciones”. En **Alertas** (`/alerts`) debe aparecer la suscripción. La barra superior muestra la búsqueda activa; en **Feed** o **Feed lista** los resultados respetan ese filtro.

---

## Qué debería ver el usuario

- **Búsqueda guardada:** “Demo Rosario 2 dorm” con filtros típicos (Rosario, 2 dorm, max precio).
- **Lead ACTIVE:** una consulta ya activada, con acceso a Chat y Agenda.
- **Chat:** un mensaje permitido y un mensaje bloqueado (con [BLOCKED] o indicación de bloqueo).
- **Agenda:** al menos una visita programada en el futuro.
- **Feed / lista:** propiedades con imagen de portada (assets locales en `/demo/photos/`), sin depender de internet.

---

## Si la demo está deshabilitada

En `/demo` se muestra “Demo deshabilitada (DEMO_MODE=0)”. Eso es esperado en producción. En local, asegurarse de que `DEMO_MODE=1` esté definido cuando se corre `dev:up` o `start` (los scripts ya lo setean para ingest y demo:data).

---

## Relación con otros docs

- **DEV.md:** cómo levantar el entorno y comandos básicos.
- **PROD.md:** DEMO_MODE=0 en prod y variables de entorno.
