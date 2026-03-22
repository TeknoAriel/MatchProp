# Deploy automático — Configuración mínima (sin tokens nuevos)

No tocamos Neon, Vercel ni claves compartidas. Solo esto:

---

## Un solo cambio en GitHub

**Desactivar la protección de la rama `main`** para que el bot pueda mergear sin tokens extra.

1. **Ir a:** https://github.com/TeknoAriel/MatchProp/settings/branches

2. Si hay una regla para `main`, clic en **Delete** (eliminar la regla).

   O si preferís editarla:
   - **Edit** → Desactivar **Require a pull request**
   - O poner **Require approvals: 0** y desactivar todo lo demás
   - **Save**

3. Con eso, el flujo actual (PR + automerge con GITHUB_TOKEN) puede mergear solo.

---

## Qué NO hay que tocar

- ❌ No crear `AUTOMERGE_TOKEN`
- ❌ No cambiar `CRON_SECRET`, `DATABASE_URL` ni variables de Vercel
- ❌ No tocar Neon ni Vercel

---

## Flujo después de esto

1. Push a tu rama → se crea/actualiza el PR
2. CI corre
3. Cuando CI pasa → merge automático con GITHUB_TOKEN
4. Vercel despliega
