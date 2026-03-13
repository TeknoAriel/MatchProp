# Deploy Checklist

## Pre-deploy

- [ ] `pnpm build:shared`
- [ ] `pnpm --filter api build`
- [ ] `pnpm --filter web build`
- [ ] Variables API: `DATABASE_URL`, `JWT_SECRET`, `AUTH_REFRESH_SECRET`, `APP_URL`, `API_PUBLIC_URL`, `CORS_ORIGINS`, `COOKIE_SECURE`, `DEMO_MODE`
- [ ] Variables Web: `API_SERVER_URL`, `NEXT_PUBLIC_API_URL`

## Deploy

```bash
git push origin main
```

Vercel despliega API y Web automáticamente.

## Post-deploy

- [ ] Verificar https://match-prop-web.vercel.app/login
- [ ] Verificar https://match-prop-api-1jte.vercel.app/health
- [ ] Probar «Entrar con link demo» en login
