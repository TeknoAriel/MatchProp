# Prueba real de demo (5 minutos, solo navegador)

Guía para validar que la demo no retrocedió: UI funciona y muestra datos. Ejecutar con la app levantada (`pnpm start` o `./scripts/dev-up.sh`).

## Requisitos

- Navegador en `http://localhost:3000`
- Usuario de prueba (ej. magic link con email de dev) o login existente

---

## Paso 1 — /status (inventario OK)

1. Ir a **http://localhost:3000/status**
2. **Qué debe verse:**
   - **WEB OK** = OK
   - **API OK (GET /api/health)** = OK
   - **AUTH OK (GET /api/auth/me)** = OK
   - **LISTINGS COUNT** = número (idealmente ≥ 200; en demo ≥ 500)
   - Botón "Reintentar" actualiza los valores

Si LISTINGS COUNT es N/A o 0, el inventario no está cargado: ejecutar `pnpm --filter api demo:data` y/o `pnpm --filter api ingest:bundle -- --fixture`.

---

## Paso 2 — /assistant (generar + ver resultados + guardar)

1. Ir a **http://localhost:3000/assistant**
2. Escribir en el textarea algo como: _"Comprar depto 2 dorm en Rosario hasta 120k USD"_
3. Clic en **Generar búsqueda**
4. **Qué debe verse:**
   - Explicación en texto
   - Bloque "Resumen" con filtros en lenguaje natural
   - Botones: **Guardar búsqueda**, **Ver resultados ahora**
5. Clic en **Ver resultados ahora**
6. **Qué debe verse:**
   - Título "Resultados"
   - Lista de hasta 10 cards con foto, precio, ubicación (o mensaje "No encontramos..." con CTAs "Ver todo el feed" / "Ajustar búsqueda")
   - Si hay más resultados: botón **Cargar más**
7. Clic en **Guardar búsqueda**
8. **Qué debe verse:**
   - Aparece **Ir a búsqueda** y **Ver en lista** (links verdes/azul)

---

## Paso 3 — /feed (swipe 5 propiedades)

1. Ir a **http://localhost:3000/feed**
2. **Qué debe verse:**
   - Una card grande (modo Tinder) con imagen, título, precio, ubicación
   - Botones de acción (ej. Like / Nope / Favorito) y enlace **Modo Lista**
3. Hacer swipe (o equivalente) en **5 propiedades** (like/nope/fav)
4. No debe quedar pantalla vacía sin opciones: si hay búsqueda activa y no hay matches, debe aparecer el banner "No hubo matches exactos, mostrando similares" y seguir mostrando cards.

---

## Paso 4 — /alerts (activar + ver)

1. Ir a **http://localhost:3000/searches**
2. Entrar a una búsqueda guardada (ej. la creada en el paso 2)
3. En la sección **Alertas**, clic en **Activar** para "Nuevas publicaciones"
4. **Qué debe verse:**
   - Estado "Activa" o equivalente en esa búsqueda
5. Ir a **http://localhost:3000/alerts**
6. **Qué debe verse:**
   - Título "Alertas"
   - Al menos una suscripción (ej. "Nuevas publicaciones") o enlace a búsqueda guardada

---

## Paso 5 — /leads (crear pending + activar + chat bloquea mail)

1. Desde **/feed** o **/feed/list**, en una propiedad clic en **Quiero que me contacten** (o similar) para crear una consulta.
2. Ir a **http://localhost:3000/leads**
3. **Qué debe verse:**
   - Listado de consultas; al menos una en estado PENDING o ACTIVE
4. Si hay lead PENDING, clic en **Activar ahora** (si aplica).
5. Abrir el **chat** de un lead (link "Chat" o similar).
6. En el chat, escribir un mensaje que contenga un email (ej. _"mi email es test@example.com"_) y enviar.
7. **Qué debe verse:**
   - Indicación de que el mensaje fue bloqueado (ej. "[BLOCKED]" o "bloqueado") para no exponer email en claro.

---

## Resumen de comprobaciones

| Ruta       | Comprueba                                                   |
| ---------- | ----------------------------------------------------------- |
| /status    | API + auth OK; LISTINGS COUNT ≥ 200 (ideal 500)             |
| /assistant | Generar → resumen → Ver resultados → cards o CTAs → Guardar |
| /feed      | Card Tinder visible; swipe; no pantalla vacía               |
| /feed/list | Lista de propiedades o empty con CTA                        |
| /alerts    | Tras activar en /searches/:id, subscription visible         |
| /leads     | Consultas; activar; chat bloquea envío de email             |

Si algo falla, no avanzar: revisar logs (`.logs/api.log`, `.logs/web.log`) y datos (demo:data, ingest:bundle).
