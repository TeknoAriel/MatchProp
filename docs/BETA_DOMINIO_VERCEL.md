# URL estable para beta testers (Vercel)

Objetivo: que los probadores usen **una URL fija** (p. ej. `https://match-prop.beta.vercel.app` o un dominio propio tipo `beta.tudominio.com`) apuntando al **último deploy de una rama** (p. ej. `chore/sprints-1-4-automata`), mientras el equipo sigue usando **previews por commit** u otras URLs.

## Opción recomendada: dominio asignado a una rama

En el proyecto **match-prop-web** (Vercel → proyecto → **Settings** → **Domains**):

1. **Add** el dominio que quieras usar (dominio propio verificado en DNS, o el subdominio que Vercel te permita asociar al proyecto).
2. En la configuración del dominio, asignalo al **Git branch** de beta (p. ej. `chore/sprints-1-4-automata`), si tu plan/UI lo ofrece (“Assign to Git Branch” / dominio de rama).

Así cada push a esa rama actualiza **la misma URL** sin depender del hash largo del preview.

## Alternativa: segundo proyecto Vercel

Crear un proyecto **match-prop-web-beta** enlazado al mismo repo, con **Production Branch** = rama de beta. La URL `*.vercel.app` de ese proyecto queda estable para esa rama; **producción** (`match-prop-web` + `main`) no se toca.

## Variables de entorno

- En el deploy **Web** de beta: mismas variables que producción (`API_SERVER_URL`, cookies, etc.), salvo que quieras apuntar a una API de staging (no suele hacer falta: el proxy `/api/*` sigue yendo a la API configurada).
- Si la API valida `APP_URL` / redirects: agregá la URL beta a la lista de orígenes permitidos en la API solo si hay checks explícitos por host (el flijo normal con proxy same-origin en la web no suele requerir cambiar `CORS_ORIGINS` para `/api` desde el mismo dominio beta).

## Referencia

- Producción canónica: [VERCEL_CONFIG.md](./VERCEL_CONFIG.md), [INFRAESTRUCTURA_VERCEL.md](./INFRAESTRUCTURA_VERCEL.md).
- Invitación beta (copy): [GUION_INVITACION_BETA.md](./GUION_INVITACION_BETA.md) — actualizá allí la URL cuando el dominio quede configurado.
