# MatchProp — Masterplan de producto v3.2

Documento de referencia único: visión, UX, navegación y reglas de diseño.  
Última actualización: alineado con la simplificación “simple por defecto / avanzado accesible”.

---

## 1. Visión del producto

**MatchProp** es un buscador inmobiliario ágil, dinámico y agradable que:

- Cruza **oferta** con **demanda** (búsquedas guardadas y activas).
- Conecta **propiedades** con **perfiles de búsqueda**.
- Permite **descubrir** propiedades de forma simple y rápida (experiencia tipo descubrimiento).
- Sirve a **personas** y a **inmobiliarias** sin que el modo profesional domine la experiencia principal.

La promesa percibida: _la forma más simple, moderna y atractiva de encontrar propiedades_.

---

## 2. Principios UX (rectores)

1. **Simplicidad** por sobre completitud.
2. **Una acción clara** por pantalla (jerarquía explícita).
3. **Descubrimiento dinámico** (swipe / match) como eje emocional.
4. **Buscador asistido** como entrada principal al producto autenticado.
5. **Experiencia agradable** que invite a quedarse (ritmo, feedback, menos ruido).
6. **Funcionalidad profesional** disponible pero **no visible por defecto**.

**Regla de oro ante la duda:** mostrar **menos** es mejor que mostrar **más**.

---

## 3. Estructura de navegación

### 3.1 Flujo principal (siempre visible)

Orden conceptual y reflejado en navegación principal (sidebar + barra inferior móvil):

| Orden | Destino                     | Rol                                                             |
| ----: | --------------------------- | --------------------------------------------------------------- |
|     1 | **Buscar** (`/dashboard`)   | Buscador asistido: describir la búsqueda y activar el contexto. |
|     2 | **Match** (`/feed`)         | Deck / swipe: descartar o mostrar interés.                      |
|     3 | **Mis match** (`/me/match`) | Intereses guardados y seguimiento.                              |
|     4 | **Lista** (`/feed/list`)    | Vista densa para análisis y comparación.                        |

### 3.2 Herramientas y modo avanzado (agrupadas)

Accesibles bajo **“Más herramientas”** (escritorio) o **“Más”** (móvil), sin competir con el flujo principal:

- **Asistente avanzado** (`/assistant`) — filtros finos, vista previa, afinado.
- **Mapa** (`/search/map`).
- **Listas y favoritos** (`/me/saved`) — listas personalizadas y favoritos.
- **Búsquedas guardadas** (`/searches`) — CRUD y gestión.
- **Alertas** (`/alerts`).
- **Consultas** (`/leads`).
- **Visitas** (`/me/visits`).
- **Perfil** (`/me/profile`).

### 3.3 Chips en páginas de contexto

En pantallas secundarias (alertas, búsquedas, resultados, etc.) solo se muestran **tres enlaces** al flujo principal: **Buscar → Match → Lista**, para orientar sin duplicar el menú global.

---

## 4. Jerarquía de funcionalidades

1. **Núcleo:** buscar → descubrir (swipe) → revisar intereses → analizar en lista.
2. **Soporte:** alertas, búsquedas guardadas, consultas, visitas.
3. **Profesional / power user:** asistente avanzado, mapa, listas compartibles, premium según reglas de negocio.

---

## 5. Simple vs avanzado

| Simple (default)                                           | Avanzado (progresivo)                                      |
| ---------------------------------------------------------- | ---------------------------------------------------------- |
| Home con campo de búsqueda + envío a Match                 | `/assistant` con preview, modos de fallback, más controles |
| Filtros ligeros en feed/lista según diseño actual          | Mapa, gestión masiva de búsquedas, alertas múltiples       |
| Tres gestos claros: descartar / interesar / favorito-lista | Listas, compartir, consultas, visitas                      |

El usuario **nunca** debería ver todas las herramientas a la vez en la misma vista.

---

## 6. Flujo principal de usuario (persona)

1. Entra a **Buscar**, describe intención (texto o voz).
2. Se activa búsqueda y se deriva a **Match** para decidir rápido.
3. Revisa aciertos en **Mis match**.
4. Si necesita comparar, usa **Lista**.
5. Si necesita profundizar, abre **Más** → búsquedas, alertas, mapa, asistente avanzado.

---

## 7. Flujo profesional (inmobiliaria)

- Mismas pantallas; el valor está en **búsquedas guardadas**, **listas**, **compartir** y **consultas**.
- Estas acciones viven en **Más** o en contexto de pantalla (p. ej. lista / ficha), no en la barra principal.
- Objetivo: **cero ruido** en el primer contacto con la app.

---

## 8. Reglas de diseño

- **Densidad:** priorizar aire y jerarquía; evitar grillas de acciones grandes en la home.
- **CTA:** un primario por bloque; secundarios discretos o en “Más”.
- **Tinder / swipe:** izquierda = descartar, derecha = me interesa; feedback visual explícito; microcopy mínimo.
- **Consistencia:** tokens `mp-*` (color, radio, superficies); toolbars compactas donde ya existan.
- **Accesibilidad:** targets táctiles ≥ 44px en móvil.
- **Login / join:** fuera del alcance de iteraciones UX de navegación (no romper flujos existentes).

---

## 9. Criterio de éxito (checklist)

- [ ] La app se siente **simple** al abrir.
- [ ] El **buscador** es el protagonista del inicio autenticado.
- [ ] **Match** se entiende sin manual.
- [ ] **Mis match** y **Lista** tienen rol claro.
- [ ] Lo **profesional** está disponible pero no domina.
- [ ] Menos menús simultáneos; una sola fuente de verdad de “dónde estoy”.

---

_Fin del documento v3.2._
