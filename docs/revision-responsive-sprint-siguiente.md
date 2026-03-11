# Revisión responsive + Sprint siguiente

**Fecha:** 2025-02-27

---

## 1) Revisión responsive

### Lo que ya funciona bien

| Área                     | Clases usadas                   | Comportamiento                            |
| ------------------------ | ------------------------------- | ----------------------------------------- |
| **Layout header**        | `flex gap-1 sm:gap-2 flex-wrap` | Nav envuelve en móvil; más espacio en sm+ |
| **Feed / Lista / Saved** | `max-w-md` o `max-w-lg mx-auto` | Contenedor centrado, ancho fijo           |
| **Botones y links**      | `flex flex-wrap gap-2`          | Envuelven en pantallas chicas             |
| **Modales**              | `max-w-sm w-full p-5`           | Modales adaptados a móvil                 |
| **Cards**                | `truncate`, `max-w-[180px]`     | Texto largo truncado                      |
| **Landing**              | `flex flex-col sm:flex-row`     | Columna en móvil, fila en sm+             |
| **Assistant**            | `w-full sm:w-auto`              | Botones full-width en móvil               |

### Posibles mejoras

| Riesgo               | Ubicación                             | Propuesta                                                                                                    |
| -------------------- | ------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| **Header feed**      | `flex justify-between` con h1 + links | En móvil, h1 y links pueden comprimirse. Considerar `flex-col` en xs o menú hamburguesa si hay muchos links. |
| **Feed list header** | Mismo patrón                          | Mismo ajuste si se ve apretado.                                                                              |
| **ActiveSearchBar**  | `truncate max-w-[200px]`              | En móvil podría cortar demasiado. Revisar si 200px es adecuado.                                              |
| **Modales**          | `max-w-sm`                            | En móvil con teclado abierto, asegurar `overflow-y-auto` si el contenido es alto.                            |
| **Lista de cards**   | Sin virtualización                    | Listas muy largas pueden afectar performance. Considerar virtualización (e.g. react-window) más adelante.    |

### Resumen

- La base responsive es correcta: `flex-wrap`, `max-w-*`, `sm:`, `truncate`.
- No hay breakpoints `md:` ni `lg:` en la mayoría de vistas; el diseño es móvil-first con sm.
- Para móvil real, probar en viewport 320px–375px y revisar header del feed y ActiveSearchBar.

---

## 2) Sprint siguiente (pendientes)

### Fuentes: sprint-completamiento, gap-check, backlog

### Pendientes explícitos (sprint-completamiento)

| Ítem                                         | Estado    | Prioridad |
| -------------------------------------------- | --------- | --------- |
| PROD.md: demo off, checklist pre-prod        | Pendiente | Media     |
| Smoke: validar dashboard → feed con búsqueda | Pendiente | Media     |
| Dashboard: redirect cuando hay active search | Pendiente | Baja      |

### Pendientes por gap-check

| Ítem                                  | Impacto |
| ------------------------------------- | ------- |
| Monetización B2B/B2C (wallet, Stripe) | Medio   |
| Feature flags formalizados            | Medio   |
| Portal SEO                            | Bajo    |

### Backlog — próximos sprints

| Sprint                      | Contenido                                                         |
| --------------------------- | ----------------------------------------------------------------- |
| **Sprint 9 — Monetización** | Wallet B2B, Premium B2C (Stripe), feature flags, demo off en prod |
| **Sprint UX / estabilidad** | Virtualización lista, smoke actualizado, fixes dashboard          |
| **Sprint responsive**       | Ajustes header/ActiveSearchBar, menú móvil si hace falta          |

---

## 3) Recomendación: Sprint siguiente

**Nombre:** Sprint Estabilidad + UX

**Scope sugerido:**

1. **Dashboard** — Redirect cuando hay active search; validar flujo dashboard → feed.
2. **Smoke** — Actualizar smoke e2e para cubrir ese flujo.
3. **PROD** — Completar PROD.md (demo off, checklist pre-prod).
4. **Responsive** — Revisar header del feed y ActiveSearchBar en móvil; ajustes mínimos si hay overflow.

**Alternativa:** Sprint Monetización (Sprint 9) si la prioridad de negocio es pagos.
