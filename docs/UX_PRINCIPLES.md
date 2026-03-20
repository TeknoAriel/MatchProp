# Principios UX — MatchProp

**Objetivo:** Interfaz minimalista, simple y amigable para usuarios de 25 a 70 años. Que invite a recorrer y usar todas las opciones.

---

## Pilares

1. **Minimalismo** — Menos ruido visual, más espacio en blanco. Una acción principal por pantalla cuando sea posible.
2. **Legibilidad** — Fuente base 16px, line-height 1.6, contraste suficiente (WCAG AA).
3. **Accesibilidad táctil** — Tap targets mínimo 44–48px; botones e links fácilmente clickeables.
4. **Colores suaves** — Paleta amigable, sin tonos agresivos; azul cielo (#0EA5E9) como accent.
5. **Navegación clara** — Sidebar y bottom nav con labels descriptivos; breadcrumbs en flujos profundos.
6. **Feedback inmediato** — Estados de loading, mensajes de error claros, confirmaciones breves.

---

## Implementación

- **globals.css:** Variables CSS (--mp-\*), font-size 16px, line-height 1.6, antialiasing.
- **AppShell:** min-h 44–52px en nav items; tipografía 15px; bordes redondeados (rounded-xl).
- **Login:** Inputs grandes, botón primario destacado, espaciado generoso.
- **Responsive:** 320px y 375px sin overflow; bottom nav en móvil con íconos + labels.

---

## Referencias

- [responsive-checklist.md](./responsive-checklist.md)
- [Tailwind config](../apps/web/tailwind.config.ts) — colores mp, minHeight tap
