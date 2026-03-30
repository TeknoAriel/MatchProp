# Configuración una sola vez — después el agente y GitHub hacen todo

Hacé esto **solo una vez**. Después: push al branch → PR → CI verde → merge automático → Vercel. **No volvés a tocar merge ni secretos** (salvo que cambies el token o las reglas del repo).

---

## Orden recomendado (copiá las URLs en el navegador)

### A) Permitir auto-merge en el repositorio

1. Abrí: **https://github.com/kiteprop/ia-matchprop/settings**
2. En el menú izquierdo, en **General** (ya estás ahí si entraste por el link).
3. Bajá hasta la sección **Pull Requests**.
4. Activá la opción **Allow auto-merge** (checkbox).
5. Guardá si aparece **Save** (a veces se aplica al instante).

> Sin esto, GitHub puede no permitir el merge automático aunque el workflow corra.

---

### B) Permisos de los workflows (lectura/escritura)

1. Abrí: **https://github.com/kiteprop/ia-matchprop/settings/actions**
2. En **Workflow permissions**, elegí **Read and write permissions**.
3. **Save**.

---

### C) Secret `AUTOMERGE_TOKEN` (merge automático con branch protection)

El token del workflow por defecto **no** puede mergear a `main` protegido. Hace falta un token personal **una vez**.

**C1 — Crear token (tu cuenta GitHub)**

1. Abrí: **https://github.com/settings/tokens**
2. **Generate new token (classic)**.
3. **Note** (nombre): ejemplo `MatchProp automerge`
4. **Expiration**: la que prefieras (ej. 1 año).
5. Marcá el scope **`repo`** (tilda todo el bloque).
6. **Generate token**.
7. **Copiá el valor** (empieza con `ghp_`). No lo compartas ni lo pegues en chats.

**C2 — Guardarlo en el repo**

1. Abrí: **https://github.com/kiteprop/ia-matchprop/settings/secrets/actions**
2. **New repository secret**
3. **Name** (exacto, mayúsculas como acá): `AUTOMERGE_TOKEN`
4. **Secret**: pegá el token que copiaste en C1.
5. **Add secret**.

---

### D) Branch protection en `main` (que el bot pueda mergear sin tu aprobación)

1. Abrí: **https://github.com/kiteprop/ia-matchprop/settings/branch_protection_rules/new**  
   O si ya existe regla para `main`: **https://github.com/kiteprop/ia-matchprop/settings/branches** → **Edit** junto a la regla de `main`.

2. Asegurate de:
   - **Require a pull request before merging**: puede estar **activado** (queremos PR).
   - **Required number of approvals before merging**: **0** (cero). Si pedís 1 o más, **vos** tenés que aprobar y no es “sin intervención”.
   - **Require conversation resolution before merging**: **desactivado**.
   - **Require review from Code Owners**: **desactivado**.
   - **Require status checks to pass**: **activado** y los checks del CI (typecheck, lint, tests, build, etc.).

3. **Save changes**.

---

### E) Verificar que el PR se crea solo (ya está en el código)

Con cada push a un branch que no sea `main`, el workflow **Deploy auto (PR + automerge)** crea el PR y pone la etiqueta `automerge`.

Revisá en: **https://github.com/kiteprop/ia-matchprop/actions**

---

## Qué hace el agente (Cursor) sin pedirte nada

- `git add` / `commit` / `push` al branch de trabajo.
- Verificaciones locales cuando corresponda (`pre-deploy:verify` o equivalente).

## Qué **no** puede hacer el agente

- Pegar secretos en GitHub (solo vos en la web).
- Cambiar reglas de branch protection (solo vos con permisos de admin del repo).

---

## Después de esta configuración

1. El agente pushea a `docs-url-canon-20260320` (u otro branch).
2. Se abre/actualiza el PR a `main` con etiqueta `automerge`.
3. Pasa CI → merge automático → Vercel deploya.

**No tenés que volver a mergear a mano** salvo excepciones (conflictos, CI rojo, token vencido).
