# URL única de pruebas y manejo de proyectos

## Regla principal

**Para probar la app (login, feed, búsqueda, mapa, favoritos, perfil, etc.) usá siempre y solo esta URL:**

### https://match-prop-web.vercel.app/

Ahí se ven **todos los cambios** que hacemos en el frontend (`apps/web`). No uses ninguna otra URL para probar la experiencia de usuario.

---

## Por qué a veces no se ven los cambios

1. **Deploy de web en Error**  
   Si en Vercel el proyecto **match-prop-web** tiene el último deploy en rojo (Error), en esa URL sigue la versión anterior.  
   → Entrá a [Vercel → match-prop-web → Deployments](https://vercel.com/teknoariels-projects/match-prop-web/deployments) y comprobá que el último deploy esté **Ready**. Si está en Error, hay que corregir el build antes de volver a probar.

2. **Caché del navegador**  
   Hacé **recarga forzada**: `Ctrl+Shift+R` (Windows/Linux) o `Cmd+Shift+R` (Mac). O probá en una ventana de incógnito.

3. **Estabas en otra URL**
   - **match-prop-admin.vercel.app** = panel admin (otra app).
   - **match-prop-api-1jte.vercel.app** = API (JSON, no interfaz).  
     Para probar la app que usa el usuario final, solo **match-prop-web.vercel.app**.

---

## Resumen de las 3 URLs (solo una es para probar la app)

| URL                                    | Para qué                                           | ¿Probás cambios de la app ahí? |
| -------------------------------------- | -------------------------------------------------- | ------------------------------ |
| **https://match-prop-web.vercel.app/** | App principal (feed, búsqueda, mapa, perfil, etc.) | **Sí — siempre probá acá**     |
| https://match-prop-admin.vercel.app    | Panel admin (gestión interna)                      | No                             |
| https://match-prop-api-1jte.vercel.app | API (backend)                                      | No (es JSON)                   |

---

## Qué revisar cuando reportás “no se ve el cambio”

1. ¿Estás en **https://match-prop-web.vercel.app/**?
2. ¿Hiciste **recarga forzada** (Ctrl+Shift+R / Cmd+Shift+R)?
3. En Vercel → **match-prop-web** → Deployments: ¿el último deploy está **Ready** (verde)?

Si las tres son sí y aún no ves el cambio, entonces hay que revisar el código o el deploy. Si alguna es no, corregir eso primero (URL correcta, caché, o deploy en verde).

---

## Cuándo se despliega cada proyecto

- **match-prop-web**: se despliega en cada push a `main` que toque `apps/web` o `packages/shared`. Si solo cambió `apps/api` o `apps/admin`, web no se re-despliega (y no deberías esperar cambios en la URL de pruebas).
- **match-prop-admin**: se despliega cuando cambian `apps/admin` o `packages/shared`.
- **match-prop-api-1jte**: se despliega cuando cambian `apps/api` o `packages/shared`.

Así evitamos confusión: cambios en la app de usuario → siempre en **match-prop-web.vercel.app**.
