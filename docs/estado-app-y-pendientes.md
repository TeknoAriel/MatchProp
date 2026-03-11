# Estado de la App MatchProp — Lo que falta para terminar

**Basado en Masterplan v3.0, Backlog, Alignment Checklist y Sprint 14**

---

## Resumen ejecutivo

| Área            | Estado         | Pendiente principal                                        |
| --------------- | -------------- | ---------------------------------------------------------- |
| E1–E6 (core)    | DONE / PARTIAL | Asistente PRO (50 ejemplos), Ficha PRO (mapa)              |
| E7 Monetización | NOT STARTED    | Wallet B2B, Stripe B2C                                     |
| E8 Portal SEO   | NOT STARTED    | Scope a definir                                            |
| Sprint 14       | PARTIAL        | 50 ejemplos, demo photos; PUT /preferences y voz ya hechos |

---

## Hecho ✅

- **E1** Feed Tinder + lista, swipe, undo
- **E2** Leads PENDING/ACTIVE/CLOSED, funnel anti-cierre
- **E3** Chat controlado + filtro anti-PII (API)
- **E4** Agenda de visitas (API)
- **E5** SavedSearch, alertas NEW/PRICE_DROP/BACK_ON_MARKET
- **E6** Asistente texto → SearchFilters (parser determinístico); **búsqueda por voz** (Web Speech API, botón micrófono en /assistant)
- **E8** Kiteprop, difusiones, trackEvent
- ActiveSearchBar, FilterChips, favoritos, listas, "Quiero que me contacten"
- CRM push, MatchEvent, demo dataset

---

## Pendiente (priorizado)

### 1. Asistente PRO (Sprint 14)

- [ ] **50 ejemplos** de búsqueda (hoy: 3)
- [x] **PUT /preferences** al aplicar filtros ("Ver resultados ahora") — ya implementado en /assistant
- [x] **Búsqueda por voz** — Web Speech API + botón micrófono en /assistant

### 2. Búsqueda por mapa, zonas, regiones o barrios

- [x] Filtro "Ciudad o zona" y "Dirección" en /search (locationText, addressText)
- [ ] Sección o vista dedicada "Buscar por mapa" (ver plan-completamiento-100.md Fase 5.0)

### 3. Ficha PRO (Sprint 14)

- [ ] Mapa si lat/lng (hoy: placeholder)
- [ ] Galería con navegación (parcialmente hecho)

### 4. Demo PRO (Sprint 14)

- [ ] 50 fotos SVG en `/demo/photos/`
- [ ] Seed con description, details, heroImageUrl alineados

### 5. Monetización (E7)

- [ ] Wallet B2B
- [ ] Premium B2C (Stripe)
- [ ] Mercado Pago provider

### 6. UI Chat y Agenda

- [x] UI de chat en /leads/:id — **DONE** (burbujas, tema, enlace a agenda)
- [x] UI de agenda/visitas — **DONE** (tema, enlace a chat; “Ver agenda” en lista de consultas)

### 7. Otros

- [ ] Virtualización lista larga (performance)
- [ ] Portal SEO
- [ ] Feature flags formales

---

## Asistente de búsqueda por voz ✅

**Implementado.** Web Speech API en `useSpeechRecognition.ts`; botón micrófono en `/assistant`; al terminar de escuchar se transcribe y se llama a la búsqueda. Fallback si el navegador no soporta voz.

---

**Plan de trabajo detallado:** ver [plan-completamiento-100.md](./plan-completamiento-100.md) para fases, tareas y criterios de done hasta 100% funcional.
