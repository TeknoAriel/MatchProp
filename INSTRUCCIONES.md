# Cómo probar MatchProp

## Requisitos previos

- **Docker Desktop** instalado y **abierto** (para la base de datos).
- **Node.js** y **pnpm** instalados.

---

## Opción 1 — Doble clic (la más fácil)

1. Abrí la carpeta **MatchProp** en Finder.
2. Hacé **doble clic** en el archivo **`iniciar.command`**.
3. Se abre la Terminal; esperá 2–3 minutos (carga la base de datos y los datos de demo).
4. Cuando termine, se abre el navegador en la pantalla de login.
5. Para entrar: email **smoke-ux@matchprop.com** → "Enviar link" → "Abrir link de acceso (dev)".

---

## Opción 2 — Terminal

1. Abrí **Terminal** (Aplicaciones → Utilidades → Terminal).
2. Escribí: `cd` + espacio, arrastrá la carpeta MatchProp a la Terminal y Enter.
3. Escribí: `pnpm iniciar` y Enter.
4. Esperá 2–3 minutos.
5. Se abre el navegador; usá **smoke-ux@matchprop.com** para entrar.

---

## Páginas disponibles

- **Login:** http://localhost:3000/login
- **Feed:** http://localhost:3000/feed
- **Asistente de búsqueda:** http://localhost:3000/assistant
- **Búsquedas guardadas:** http://localhost:3000/searches
- **Estado:** http://localhost:3000/status

---

## Si algo falla

- Asegurate de que **Docker Desktop** esté abierto y corriendo.
- Si dice "puerto ocupado": cerrá otras apps que usen 3000 o 3001.
- Logs: mirá los archivos `.logs/api.log` y `.logs/web.log`.
