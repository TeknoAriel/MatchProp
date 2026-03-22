# Verificación: ¿está todo deployado? (Git · Web · API · Neon)

Comprobación de que **todos** los commits y migraciones están alineados entre Git, Vercel (Web + API) y Neon. Sirve para detectar deploys a mitad de camino o desajustes históricos.

---

## Verificación rápida

```bash
./scripts/verificar-deploy.sh
```

Con tu rama (para ver commits sin mergear):

```bash
./scripts/verificar-deploy.sh docs-url-canon-20260320
```

---

## Qué compara el script

| Fuente         | Cómo obtiene el commit            | Cómo obtiene migración                |
| -------------- | --------------------------------- | ------------------------------------- |
| **Web**        | GET /version (Vercel inyecta SHA) | —                                     |
| **API**        | GET /version o /health            | Tabla `_prisma_migrations` en Neon    |
| **main (git)** | `git rev-parse origin/main`       | —                                     |
| **Repo**       | —                                 | Última carpeta en `prisma/migrations` |

---

## Desajustes que detecta

1. **Web ≠ API**: Commits distintos → un deploy de Vercel falló a mitad.
2. **main ≠ Web/API**: Hay commits en main que aún no están en prod.
3. **Neon ≠ Repo**: La última migración en Neon no coincide con la última en el repo → faltan migraciones.

---

## Endpoints de versión

- **Web:** `GET https://match-prop-web.vercel.app/version` → `{ version, commit }`
- **API:** `GET https://match-prop-admin-dsvv.vercel.app/version` → `{ version, commit, migration }`
- **API /health:** también incluye `version` y `migration`

---

## Si hay desajuste

| Desajuste       | Qué hacer                                                                             |
| --------------- | ------------------------------------------------------------------------------------- |
| Web ≠ API       | En Vercel → Deployments: revisar que Web y API estén en Ready. Redeploy el que falle. |
| main no en prod | Esperar 2–3 min tras el merge. Si pasó más, revisar Vercel.                           |
| Neon atrasado   | `DATABASE_URL="..." bash scripts/prod-migrate.sh`                                     |

---

## Flujo de deploy

1. Push → PR creado/actualizado
2. CI pasa → merge a main
3. Vercel despliega Web + API
4. Migraciones: se aplican manualmente o en un step de build (según tu config)
5. `./scripts/verificar-deploy.sh` confirma alineación

---

## Checklist post-merge

- [ ] `./scripts/verificar-deploy.sh` sin desajustes
- [ ] Probar https://match-prop-web.vercel.app/login
- [ ] Probar /status y verificar versión
