# Deploy Checklist

## Pre-deploy

- [ ] `pnpm run pre-deploy:verify` (build shared, typecheck, build api/web/admin, test:all). Ver [PROD.md](./PROD.md).
- [ ] Variables API: `DATABASE_URL`, `JWT_SECRET`, `AUTH_REFRESH_SECRET`, `APP_URL`, `API_PUBLIC_URL`, `CORS_ORIGINS`, `COOKIE_SECURE`, `DEMO_MODE=0`, `INTEGRATIONS_MASTER_KEY`
- [ ] Variables Web: `API_SERVER_URL`, `NEXT_PUBLIC_API_URL`
- [ ] Migraciones: `pnpm run deploy:pre` (o `DATABASE_URL=... pnpm --filter api exec prisma migrate deploy` contra DB de prod).

## Deploy

```bash
git push origin main
```

Vercel despliega API y Web automáticamente.

## Post-deploy

- [ ] Verificar https://match-prop-web.vercel.app/login
- [ ] Verificar https://match-prop-admin-dsvv.vercel.app/health
- [ ] Probar «Entrar con link demo» en login
