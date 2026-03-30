# Crear un PR en 3 clics (sin saber Git)

## Opción A — Link directo (recomendado)

1. Abrí esta URL en el navegador (ya compara la rama con `main`):

   **https://github.com/kiteprop/ia-matchprop/compare/main...chore/subir-web-produccion**

2. Si ves los cambios y el botón verde **“Create pull request”**, hacé clic.

3. Podés dejar el título por defecto o poner uno corto → de nuevo **“Create pull request”**.

Listo: el PR queda abierto. Cuando el **CI** (Actions) termine en verde, podés **Merge** o dejar que el **auto-merge** lo haga si configuraste el token (ver abajo).

---

## Opción B — Desde el repo

1. Entrá a: https://github.com/kiteprop/ia-matchprop
2. **Pull requests** → **New pull request**
3. **base:** `main` ← **compare:** `chore/subir-web-produccion` → **Create pull request**

---

## Si no aparece el botón

- La rama puede no existir en GitHub: pedile a quien tenga el repo que haga `git push` de esa rama.
- No tenés permisos de escritura en el repo: el dueño debe agregarte como **collaborator** o **member** del org.
