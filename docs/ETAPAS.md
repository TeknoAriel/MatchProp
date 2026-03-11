# Etapas del proyecto — MatchProp

Ruta de crecimiento por etapas, documentada y reproducible.

---

## Etapa actual: Producción Beta ✅

**Estado:** Listo para deploy público con testers beta.

### Completado

- [x] Monorepo estable (web, api, shared, admin, mobile)
- [x] Arranque robusto (`pnpm dev:up`)
- [x] Escalabilidad documentada (100k usuarios, 200k propiedades)
- [x] Config deploy: Vercel (web + API) + Neon (DB)
- [x] Docs: ARCHITECTURE, DEPLOY, SCALABILITY, PROD
- [x] pre-deploy:verify pasando

### Completado (deploy git)

- [x] Remote configurado: `git@github.com:TeknoAriel/MatchProp.git`
- [x] Código en GitHub: https://github.com/TeknoAriel/MatchProp

### Pendiente para deploy efectivo

1. **Crear DB en Neon (gratis):** https://neon.tech → copiar `DATABASE_URL` → correr migraciones (ver `docs/SIGUIENTE_PASO.md`)
2. **Conectar Vercel (API):** https://vercel.com/new → Importar `TeknoAriel/MatchProp` → Root = `apps/api`
3. **Conectar Vercel (Web):** https://vercel.com/new → Importar `TeknoAriel/MatchProp` → Root = `apps/web` → env `API_SERVER_URL` = URL de la API en Vercel
4. **Variables:** ver `docs/DEPLOY.md` y `docs/SIGUIENTE_PASO.md`

---

## Próximas etapas sugeridas

### Etapa 2: Datos reales

- Conectar fuentes reales (Kiteprop, APIs partners)
- `DEMO_MODE=0` en producción
- Seed inicial desde ingest

### Etapa 3: Beta cerrada

- Lista de testers invitados
- Feedback loop (formulario, analytics)
- Ajustes UX según feedback

### Etapa 4: Beta abierta

- Registro público
- Stripe Premium operativo
- Soporte básico

### Etapa 5: Lanzamiento

- Marketing
- Monitoreo 24/7
- Incident response

---

## Comandos por etapa

| Etapa   | Comando                  | Descripción                    |
|---------|--------------------------|--------------------------------|
| Dev     | `pnpm dev:up`           | Levantar todo local            |
| Verificar | `pnpm pre-deploy:verify` | Build + tests                  |
| Deploy  | `bash scripts/deploy-git.sh` | Push y deploy automático   |
| Migraciones | `pnpm deploy:pre`    | Antes de start en prod         |
