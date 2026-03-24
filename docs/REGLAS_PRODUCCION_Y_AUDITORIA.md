# Reglas de producción (GitHub) y quién las puede cambiar

## Qué son las “reglas” que frenan el merge

En este repo, la rama **`main`** tiene un **ruleset** (“Main”) que exige, entre otras cosas:

- Pull request antes de mergear (no push directo a `main` sin PR).
- Varios **status checks** obligatorios (Typecheck, Lint, tests, build).
- Política **strict** (la rama del PR debe estar al día con `main`).

Eso **no está en el código del proyecto**: se configura en **GitHub** (Settings → Rules → Rulesets, o reglas de rama clásicas).

## ¿Por qué “cambiaron sin mi consentimiento”?

Solo pueden cambiarlas quienes tengan permiso de **administración** en el repositorio u **organización** (dueño del org, admin del repo, o políticas de la empresa).

Para ver **quién tocó qué** (si está habilitado):

- Organización: **Settings → Audit log** (si aplica).
- Repo: **Settings → Moderation / Audit** según plan de GitHub.

Si no ves historial, el dueño del org/repo puede revisar permisos de **Settings → Collaborators** y **Organization members**.

## Automatización “como antes”

El flujo automático del repo depende de:

1. **Secret `AUTOMERGE_TOKEN`** en el repo (PAT con `repo`) — ver `docs/CONFIGURAR_DEPLOY_AUTOMATICO.md`.
2. **Workflows** ya en `.github/workflows/` (`deploy-auto-pr`, `merge-after-ci`, `pr-automerge-label`).
3. **Reglas de `main`**: si pedís **aprobaciones obligatorias** o **strict** muy agresivo, el bot no puede mergear solo hasta que eso se cumpla.

### Si querés menos fricción (dueño del repo)

En el **ruleset “Main”**, el dueño puede:

- Poner **0 aprobaciones** requeridas.
- Valuar desactivar **“Require branches to be up to date”** (strict) si los bloqueos por rama atrasada molestan más que ayudan.

Eso no quita el CI: los checks siguen siendo obligatorios si los dejás marcados.

## Resumen

| Querés…                         | Dónde                                             |
| ------------------------------- | ------------------------------------------------- |
| Merge automático cuando CI pasa | `AUTOMERGE_TOKEN` + etiqueta `automerge` en el PR |
| Saber quién cambió reglas       | Audit log / admins del repo                       |
| Crear un PR sin consola         | `docs/COMO_CREAR_PR.md`                           |
