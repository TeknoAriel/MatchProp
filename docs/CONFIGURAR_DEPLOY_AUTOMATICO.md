# Configurar permisos para deploy 100% automático

Si el PR se crea pero **no se hace merge automático** cuando CI pasa, o hay demoras/errores al deployar, seguí estos pasos. Solo los tenés que hacer **una vez**.

Ver también **`docs/DEPLOY_TROUBLESHOOTING.md`** para diagnóstico cuando los cambios no llegan a producción.

---

## 1. Crear `AUTOMERGE_TOKEN` (obligatorio para merge automático)

El `GITHUB_TOKEN` por defecto **no puede** mergear PRs en branches protegidos. Necesitás un token personal.

### Paso a paso

1. **Ir a**: https://github.com/settings/tokens  
   (O: tu avatar → Settings → Developer settings → Personal access tokens)

2. **Crear token**:
   - **Classic** (recomendado):
     - Click **"Generate new token (classic)"**
     - Nombre: `MatchProp-automerge`
     - Expiration: 90 días o sin expiración (según tu política)
     - Scopes: marcar **`repo`** (incluye todo: contents, pull_requests, etc.)

   - **Fine-grained** (alternativa):
     - "Generate new token (fine-grained)"
     - Repository access: "Only select repositories" → elegir MatchProp
     - Permissions:
       - **Pull requests**: Read and write
       - **Contents**: Read and write
       - **Metadata**: Read-only (por defecto)

3. **Copiar el token** (solo se muestra una vez).

4. **Agregar como secret en el repo**:
   - https://github.com/TeknoAriel/MatchProp/settings/secrets/actions
   - **"New repository secret"**
   - Name: `AUTOMERGE_TOKEN`
   - Value: pegar el token

Los workflows `pr-automerge-label`, `merge-after-ci` y `manual-merge-pr` usan este secret cuando existe. Si no está, usará `GITHUB_TOKEN` y el merge fallará en branches protegidos.

- **Merge after CI** (`.github/workflows/merge-after-ci.yml`): cuando el workflow **CI** termina en verde en un PR, intenta `squash` del PR si tiene etiqueta `automerge` (no depende solo del evento `labeled`).
- **Manual merge PR**: reserva si hace falta — **Actions → Manual merge PR** → indicar número de PR.

---

## 2. Revisar Branch Protection en `main`

Si el merge sigue fallando, revisá:

**Settings → Code and automation → Branches → Branch protection rules → `main`**

| Regla                                            | Recomendado para auto-merge                                      |
| ------------------------------------------------ | ---------------------------------------------------------------- |
| Require a pull request before merging            | ✅ Activo                                                        |
| Require status checks to pass before merging     | ✅ Activo (los 5 del CI)                                         |
| Require branches to be up to date before merging | ⚠️ Opcional: si está activo, puede retrasar el merge             |
| Require conversation resolution before merging   | ❌ Desactivado (o el bot no puede mergear)                       |
| Require approvals                                | ❌ 0 aprobaciones (o necesitás aprobar manualmente)              |
| Require review from Code Owners                  | ❌ Desactivado                                                   |
| Restrict who can push to matching branches       | Debe incluir al usuario dueño del PAT (si usás PAT de tu cuenta) |
| Allow specified actors to bypass                 | No necesario para auto-merge                                     |

Si tenés "Require approvals" > 0, el bot no puede mergear hasta que alguien apruebe. Para deploy automático sin intervención, dejalo en 0.

---

## 3. Verificar que los workflows tengan permisos

Los workflows ya están configurados. Si GitHub marca errores de permisos:

- **deploy-auto-pr**: necesita `pull-requests: write` (crear PR, labels)
- **pr-automerge-label**, **merge-after-ci**, **manual-merge-pr**: necesitan `contents: write`, `pull-requests: write`

En **Settings → Actions → General**:

- "Workflow permissions" → **Read and write permissions** (o al menos para los workflows que mergean)

---

## 4. Checklist rápido

| Qué                                          | Dónde                               | Estado                 |
| -------------------------------------------- | ----------------------------------- | ---------------------- |
| Secret `AUTOMERGE_TOKEN`                     | Repo → Settings → Secrets → Actions | Crear si no existe     |
| Branch protection: 0 aprobaciones requeridas | Branches → main                     | Revisar                |
| Workflow permissions: Read and write         | Actions → General                   | Revisar si hay errores |

---

## 5. Probar

1. Hacé un cambio mínimo (ej. un comment en un .md).
2. El agente hace commit + push a tu branch.
3. Se crea el PR con etiqueta `automerge`.
4. Esperá a que CI termine (typecheck, lint, tests, build).
5. El PR debería mergearse solo a `main`.
6. Vercel despliega; smoke-prod corre.

Si el merge no ocurre, revisá los logs del workflow "PR auto-merge" en la pestaña Actions. El error suele indicar si falta el token o si branch protection bloquea.
