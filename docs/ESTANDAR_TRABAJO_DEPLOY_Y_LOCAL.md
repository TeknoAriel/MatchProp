# Estándar de trabajo: local + deploy + validaciones

Este documento define la forma oficial de trabajo para MatchProp.

## Objetivo

- Reducir conflictos de ramas y deploys rotos.
- Mantener una URL local fija para QA rápido.
- Desplegar en bloques pequeños y validados.
- **Evitar inconsistencias local vs producción** (local siempre alineado con `main`).

## URL local fija de trabajo

- Web: `http://localhost:3000/login`
- API: `http://localhost:3001/health`

Comando estándar para levantar local:

- `bash scripts/dev-local.sh`

Notas:

- Solo se trabaja sobre MatchProp (no tocar otros proyectos locales).
- Docker compose de MatchProp usa nombre fijo `matchprop-dev`.

## Evitar inconsistencias local vs producción

**Producción (`main`) es la fuente de verdad.** Si tu local muestra una versión distinta a la de producción:

1. **Sincronizar de inmediato:**
   ```bash
   bash scripts/sync-local-from-main.sh
   ```
   Esto hace `git fetch`, `checkout main` y `pull`. Los cambios locales se guardan en stash.

2. **Flujo recomendado al empezar a trabajar:**
   - `git checkout main && git pull origin main`
   - Crear rama de feature: `git checkout -b mi-rama-feature`
   - Trabajar, validar, push y PR a `main`

3. **Tras cada merge a `main`:**
   - Actualizar local: `git checkout main && git pull origin main`
   - O ejecutar `bash scripts/sync-local-from-main.sh`

Así el local siempre refleja lo que está en producción.

## Flujo estándar por tarea

1. Implementar la mejora en rama de trabajo.
2. Validar localmente en la URL fija.
3. Verificar build/typecheck mínimo antes de push:
   - `pnpm build:shared`
   - `pnpm --filter web build` (si hay cambios web)
   - `pnpm --filter api exec tsc --noEmit` (si hay cambios API)
4. Commit pequeño y descriptivo.
5. Push de rama para activar pipeline/deploy automático.
6. Verificar estado de deploy (Ready/Error) y corregir si falla.
7. Recién después, probar en producción (`main`) cuando el PR se mergea.

## Política de deploy

- Frecuencia: deploys frecuentes en bloques pequeños (no megacambios).
- Prioridad: primero Preview estable, luego merge a `main`.
- Nunca mezclar múltiples temas no relacionados en un mismo commit/PR.

## Validaciones obligatorias antes de considerar una tarea "terminada"

- Build/typecheck pasan.
- La funcionalidad fue validada en local.
- Si aplica, validación visual en Preview.
- Sin archivos basura en commit (`tsbuildinfo`, logs temporales, etc.).

## Formato estándar de reporte al usuario tras cada tarea

En cada entrega se informa siempre:

- **Mejoras implementadas**
- **Pendientes detectados**
- **Sugerencias para el siguiente paso**

Esto mantiene visibilidad continua y evita perder contexto entre deploys.

## Checklist corto (DoD operativo)

- [ ] Funciona en `http://localhost:3000/login`
- [ ] Build/typecheck OK
- [ ] Commit limpio y acotado
- [ ] Push realizado
- [ ] Deploy Ready en Preview
- [ ] Reporte con mejoras/pendientes/sugerencias
