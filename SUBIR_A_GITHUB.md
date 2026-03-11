# Cómo subir el código a GitHub (sin usar la terminal)

> **El repo ya está en GitHub:** https://github.com/TeknoAriel/MatchProp  
> Para poner la app en producción: **docs/SIGUIENTE_PASO.md**

---

Elegí **una** de estas opciones.

---

## Opción 1: GitHub Desktop (la más simple)

1. Descargá **GitHub Desktop**: https://desktop.github.com  
2. Instalá y abrí la app. Iniciá sesión con tu cuenta **TeknoAriel**.  
3. Menú **File → Add Local Repository**.  
4. Elegí la carpeta: **`/Users/arielcarnevali/MatchProp`**.  
5. Si dice "This directory does not appear to be a Git repository", no uses esa carpeta; en Cursor el repo ya está, así que debería detectarlo.  
6. Arriba a la derecha vas a ver **"Push origin"** o un botón para publicar. Clic ahí.  
7. Listo: el código queda en https://github.com/TeknoAriel/MatchProp  

---

## Opción 2: Token en el navegador (una sola vez)

1. Entrá a: https://github.com/settings/tokens  
2. **Generate new token (classic)**.  
3. Poné un nombre (ej: "MatchProp") y marcá el permiso **repo**.  
4. Generá el token y **copiálo** (solo se muestra una vez).  
5. En Cursor, abrí una **terminal nueva** (Terminal → New Terminal).  
6. Pegá y ejecutá este comando (reemplazá `TU_TOKEN` por el token que copiaste):  
   ```bash
   cd /Users/arielcarnevali/MatchProp && git push https://TeknoAriel:TU_TOKEN@github.com/TeknoAriel/MatchProp.git main
   ```  
7. No compartas el token con nadie. Después podés revocarlo en la misma página de tokens.

---

## Opción 3: Cursor (Source Control)

1. En Cursor apretá **Cmd + Shift + G** (o el ícono de ramas en la barra izquierda).  
2. Arriba deberías ver la rama **main** y un ícono **↑** o el texto **"Push"** o **"Publish Branch"**.  
3. Clic ahí. Si te pide, elegí "GitHub" e iniciá sesión con **TeknoAriel**.  

Si no ves el botón de Push, en el menú de los **tres puntitos (...)** en ese mismo panel buscá **"Push"** o **"Publish to GitHub"**.

---

Cuando hayas subido una vez, para las próximas veces podés usar en la terminal:

```bash
cd /Users/arielcarnevali/MatchProp && git push
```

O en Cursor: Source Control → Push.
