# Siguiente paso — Deploy en vivo

El código está en **https://github.com/TeknoAriel/MatchProp**. Para tener la app en producción usá la documentación canónica:

---

## Documentación de deploy (fuente de verdad)

| Documento | Uso |
|-----------|-----|
| **[SETUP_DEPLOY_SIMPLE.md](./SETUP_DEPLOY_SIMPLE.md)** | Pasos mínimos: Neon, migraciones, variables en Vercel (API + Web), URLs de referencia. |
| **[PROD.md](./PROD.md)** | Producción: checklist pre-deploy, variables de entorno, demo sources OFF, seguridad, health. |
| **[DEPLOY_CHECKLIST.md](./DEPLOY_CHECKLIST.md)** | Pre-deploy (`pnpm run pre-deploy:verify`), deploy (`git push origin main`), post-deploy. |

---

## Resumen rápido

1. **Neon:** crear proyecto, copiar `DATABASE_URL`, aplicar migraciones:  
   `DATABASE_URL="..." pnpm --filter api exec prisma migrate deploy`
2. **Vercel API:** Root `apps/api`, configurar variables (ver SETUP_DEPLOY_SIMPLE y PROD).
3. **Vercel Web:** Root `apps/web`, `API_SERVER_URL` = URL pública de la API.
4. **Conectar:** `APP_URL` y `CORS_ORIGINS` en API con URL de la Web; redeploy si cambias variables.
5. **Subir cambios:** `git push origin main` → Vercel despliega automáticamente.

Validación: [match-prop-web.vercel.app](https://match-prop-web.vercel.app), [API /health](https://match-prop-api-1jte.vercel.app/health). Opcional: `pnpm smoke:prod`.
