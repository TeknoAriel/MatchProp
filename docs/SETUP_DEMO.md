# Setup Demo — Acceso rápido para pruebas

## Local

```bash
pnpm run dev-local
```

1. Docker debe estar corriendo.
2. Si no hay `apps/api/.env.local`, el script levanta Postgres, migra y seedea.
3. Abrí http://localhost:3000/login → **Entrar con link demo**.

## Producción (Vercel)

- **Login:** https://match-prop-web.vercel.app/login
- **Entrar con link demo:** crea sesión demo (requiere API con `DEMO_MODE=1` y `DATABASE_URL`).
- **Magic link:** si la API/DB falla, aparece botón «Abrir link de acceso (dev)» que lleva a auto-login demo.

## Auditoría remota

- **Web:** https://match-prop-web.vercel.app
- **API health:** https://match-prop-api-1jte.vercel.app/health
