# Revisión final pre-deploy

**Completar antes de cada deploy a producción.**

- **Fecha:** **\*\*\*\***\_**\*\*\*\***
- **Responsable:** **\*\*\*\***\_**\*\*\*\***
- **Versión / commit:** **\*\*\*\***\_**\*\*\*\***
- **Notas:** **\*\*\*\***\_**\*\*\*\***

---

## Entorno y configuración

- [ ] **DEMO_MODE=0** en API (obligatorio)
- [ ] **COOKIE_SECURE=true** en API
- [ ] **CORS_ORIGINS** con dominios de producción (sin localhost en prod)
- [ ] **APP_URL** y **API_PUBLIC_URL** con URLs reales
- [ ] **DATABASE_URL** apuntando a PostgreSQL de prod
- [ ] **JWT_SECRET** y **AUTH_REFRESH_SECRET** generados (no valores de dev)
- [ ] **INTEGRATIONS_MASTER_KEY** definido (Kiteprop)
- [ ] **KITEPROP_EXTERNALSITE_MODE** no es `fixture`
- [ ] **STRIPE_SECRET_KEY** y **STRIPE_WEBHOOK_SECRET** configurados si se usa Premium B2C
- [ ] Ninguna variable **DEMO_LISTINGS_COUNT** en prod (o =0)

---

## Base de datos y migraciones

- [ ] Migraciones aplicadas: `pnpm run deploy:pre` (o equivalente en CI)
- [ ] Backup de DB previo al deploy (según política)

---

## Build y tests

- [ ] `pnpm build` exitoso
- [ ] `pnpm -r typecheck` exitoso
- [ ] `pnpm --filter api test:all` exitoso
- [ ] `pnpm smoke:ux` exitoso (en staging o con env de test)

---

## Funcionalidad crítica

- [ ] Login/registro operativo
- [ ] Feed y lista cargan con búsqueda activa
- [ ] Crear consulta ("Quiero que me contacten") y ver en /leads
- [ ] Activar lead (premium o admin) y acceder a Chat y Agenda
- [ ] Healthcheck: GET /health devuelve 200 con db ok

---

## Observabilidad

- [ ] Logs sin PII
- [ ] Healthcheck configurado en plataforma de deploy

---

**Firma / OK para deploy:** **\*\*\*\***\_**\*\*\*\***
