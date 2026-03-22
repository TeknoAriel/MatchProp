# Checklist pre-deploy — Local vs Producción

Guía para dejar todo verde y sincronizar local con producción.

---

## 1. Dejar todo verde (checks locales)

```bash
# Verificación completa
pnpm run pre-deploy:verify
```

Esto ejecuta:
- Build shared
- Typecheck (todos los paquetes)
- Build api + web + admin
- Tests API

**Si hay errores:** corregirlos antes de hacer push.

---

## 2. Archivos modificados (qué subir)

Los cambios actuales incluyen:

| Área | Archivos |
|------|----------|
| **API** | `alerts.ts`, `auth.ts`, `searches.ts` |
| **Web** | `login`, `register`, `alerts`, `dashboard`, `searches`, `me/match`, `AppShell`, etc. |
| **Nuevos** | `me/match/`, `register/` |

---

## 3. Deploy a producción

### Opción A: Merge a main y push

```bash
# Ver estado
git status

# Agregar y commitear
git add -A
git commit -m "feat: SPEC búsquedas/match/alertas, login restaurado, registro, typecheck fixes"

# Si trabajás en rama feature, merge a main
git checkout main
git merge docs-url-canon-20260320  # o tu rama actual

# Push (dispara deploy en Vercel si está conectado)
pnpm run deploy:git
# o: git push -u origin main
```

### Opción B: Push de la rama actual

Si Vercel está configurado con deploys por rama (preview):

```bash
git add -A
git commit -m "feat: SPEC búsquedas/match/alertas, login, registro"
git push origin docs-url-canon-20260320
```

---

## 4. Comparar local vs producción

### URLs de producción

- **Web:** ver `next.config.ts` → `API_PROD_URL` o Vercel dashboard
- **API:** según deploy (Railway, Vercel serverless, etc.)

### Verificar que el deploy incluyó los cambios

1. **Login:** `/login` — debe tener botón "Entrar como demo" y "Volver" tras magic link
2. **Registro:** `/register` — formulario nuevo
3. **Mis match:** `/me/match` — lista ordenada
4. **Alertas:** `/alerts` — bloque "Resultado de alertas"
5. **Dashboard:** botones "Mis match" y "Mis alertas"

### Smoke test en producción

```bash
pnpm run smoke:prod
```

(Requiere `SMOKE_PROD_URL` configurado en `.env`)

---

## 5. Migraciones de base de datos

Si hay cambios en `schema.prisma`:

```bash
pnpm run deploy:pre
```

Esto ejecuta `prisma generate` y `prisma migrate deploy`.

---

## 6. Variables de entorno en producción

Ver [PROD.md](./PROD.md) para:
- `DEMO_MODE=0` en prod
- `COOKIE_SECURE=true`
- `CORS_ORIGINS`, `JWT_SECRET`, `DATABASE_URL`

---

## Resumen rápido

```bash
# 1. Verde
pnpm run pre-deploy:verify

# 2. Commit y push
git add -A && git status
git commit -m "feat: SPEC búsquedas/match/alertas, login, registro"
git push origin main   # o tu rama

# 3. Verificar en Vercel que el deploy terminó
# 4. Probar en producción las rutas clave
```
