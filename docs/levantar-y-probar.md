# Levantar todo y ejecutar pruebas

Guía rápida para tener API + Web funcionando y correr smoke y responsive.

---

## Requisitos

- **Node** >= 18 (recomendado 20)
- **pnpm** 9
- **Docker** (PostgreSQL en `localhost:5432`)

---

## Opción 1: Un solo comando (recomendado)

Desde la **raíz del repo**:

```bash
pnpm dev:up
```

Esto hace:

1. Libera puertos 3000 y 3001
2. Levanta PostgreSQL con Docker
3. Prisma generate + migrate + seed
4. Demo: reset + seed (500+ listings, DEMO_MODE=1)
5. Levanta **API** en http://localhost:3001 y **Web** en http://localhost:3000
6. Espera hasta que ambos respondan (health + web)
7. En macOS abre el navegador en http://localhost:3000/login

Cuando veas en consola **"=== READY ==="**, ya podés ejecutar las pruebas en **otra terminal**.

**Usuario demo para login:** `smoke-ux@matchprop.com` (en dev, usar el link "Abrir link de acceso (dev)" en la misma pantalla después de enviar el email).

---

## Opción 2: Levantar API y Web en dos terminales

Si preferís ver los logs de cada uno:

**Terminal 1 — Base de datos y datos:**

```bash
cd /ruta/a/MatchProp
docker compose up -d
sleep 3
pnpm --filter api exec prisma generate
pnpm --filter api exec prisma migrate deploy
DEMO_MODE=1 pnpm --filter api demo:reset-and-seed
```

**Terminal 2 — API:**

```bash
cd /ruta/a/MatchProp
pnpm build:shared
DEMO_MODE=1 pnpm --filter api dev
```

**Terminal 3 — Web:**

```bash
cd /ruta/a/MatchProp
pnpm --filter web dev
```

Cuando la API responda en http://localhost:3001/health y la web cargue en http://localhost:3000, podés correr las pruebas.

---

## Ejecutar las pruebas

Desde la **raíz del repo**, con API y Web ya levantados:

| Prueba                                                               | Comando                             |
| -------------------------------------------------------------------- | ----------------------------------- |
| **Smoke UX** (flujo completo login → assistant → feed → leads, etc.) | `pnpm smoke:ux`                     |
| **Smoke UX** (solo Playwright, sin script que levanta servidores)    | `pnpm --filter web smoke:ux`        |
| **Responsive** (320/375 px, sin overflow)                            | `pnpm --filter web test:responsive` |

Si usás **Opción 1** (`pnpm dev:up`), los servidores quedan en background; abrí una **nueva terminal** en la raíz y ejecutá:

```bash
pnpm smoke:ux
# y/o
pnpm --filter web test:responsive
```

---

## URLs útiles

| URL                              | Descripción                                                     |
| -------------------------------- | --------------------------------------------------------------- |
| http://localhost:3000            | Web (login si no estás logueado)                                |
| http://localhost:3000/login      | Login (magic link; en dev aparece "Abrir link de acceso (dev)") |
| http://localhost:3000/feed       | Feed                                                            |
| http://localhost:3000/assistant  | Asistente de búsqueda                                           |
| http://localhost:3000/search     | Búsqueda por filtros                                            |
| http://localhost:3000/search/map | Búsqueda por mapa                                               |
| http://localhost:3001/health     | Health de la API                                                |

---

## Si algo falla

- **Puertos 3000/3001 ocupados:**  
  `pnpm dev:down` y volvé a levantar, o:  
  `lsof -iTCP:3000 -sTCP:LISTEN -t | xargs kill -9` (y lo mismo para 3001).

- **Docker / DB:**  
  `docker compose down -v` y luego `pnpm dev:up` de nuevo.

- **Logs:**  
  Con `dev:up`, los logs están en `.logs/api.log` y `.logs/web.log`.

- **Playwright:**  
  Si smoke o responsive fallan por browser:  
  `pnpm --filter web exec playwright install chromium`
