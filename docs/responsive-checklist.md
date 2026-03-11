# Checklist responsive — MatchProp

**Objetivo:** Revisar que las vistas clave funcionen en viewports móvil (320px y 375px) sin overflow horizontal ni regresiones en desktop.

**Referencia:** [revision-responsive-sprint-siguiente.md](./revision-responsive-sprint-siguiente.md) (análisis previo).

---

## Viewports a probar

| Viewport   | Uso                                |
| ---------- | ---------------------------------- |
| **320px**  | Móvil muy estrecho (ej. iPhone SE) |
| **375px**  | Móvil estándar (ej. iPhone 12/13)  |
| **1280px** | Desktop (regresión)                |

---

## Páginas a revisar

### 1. `/feed`

- [x] Header: título + link "Modo Lista" (y/o búsqueda activa) no se superponen; sin overflow horizontal.
- [x] Cards de propiedades: imagen y texto visibles; botones "Quiero que me contacten" / swipe accesibles.
- [x] En 320px: nav con flex-wrap; body con overflow-x-hidden para evitar scroll horizontal.

### 2. `/feed/list`

- [x] Header: "Lista" + selector de búsqueda activa (ActiveSearchBar) sin overflow.
- [x] ActiveSearchBar: texto truncado con `max-w-[140px]` en 320px, `min-w-0` en contenedores flex.
- [x] Lista de cards: scroll vertical OK; botones y links utilizables (tap target ≥ 44px recomendado).

### 3. `/assistant`

- [x] Textarea y botones "Generar búsqueda" / "Ver resultados ahora" / "Guardar búsqueda" visibles y clickeables.
- [x] Ejemplos (chips): hacen wrap con `flex flex-wrap gap-2`; no overflow horizontal.
- [x] En 320px: botones y chips adaptados; contenedor con `max-w-xl mx-auto`.

### 4. Otras vistas (opcional)

- [ ] `/leads`: lista de leads y botones Chat / Agendar visita.
- [ ] `/searches`, `/searches/[id]`: headers y listas.
- [ ] `/login`: formulario centrado y usable.

---

## Ajustes aplicados (Fase 3.4)

| Cambio                     | Archivo                 | Descripción                                              |
| -------------------------- | ----------------------- | -------------------------------------------------------- |
| `overflow-x-hidden`        | `layout.tsx` body       | Evita scroll horizontal en viewports 320–375px           |
| `min-w-0`                  | `layout.tsx` header div | Permite que el nav haga wrap correctamente en flex       |
| `min-w-0`, `max-w-[140px]` | `ActiveSearchBar.tsx`   | Truncado correcto en 320px; `min-w-0` para flex children |

---

## Criterios de éxito

- Sin **overflow horizontal** (no scroll lateral en body).
- **Botones y links** utilizables (no cortados, área de tap razonable).
- **Texto** legible (truncado con ellipsis donde corresponda).
- En **desktop** (1280px) no regresiones: mismo contenido y comportamiento.

---

## Cómo probar

1. DevTools → Toggle device toolbar; elegir 320x568 y 375x667 (o custom).
2. Navegar a cada URL y marcar el checklist.
3. **Test automatizado:** `pnpm --filter web test:responsive` — ejecuta `e2e/responsive.spec.ts` con viewports 320 y 375; verifica que no haya scroll horizontal y que el contenido clave sea visible en /feed, /feed/list y /assistant.

---

_Última actualización: Fase 3.4 (revisión 320/375px); Sprint Fase 2–3 (plan-completamiento-100)._
