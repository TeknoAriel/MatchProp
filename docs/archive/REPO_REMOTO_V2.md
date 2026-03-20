# MatchProp v2.0 — Crear Repo Remoto y Push Inicial

## Estado actual

- Repo git inicializado
- Primer commit realizado: `MatchProp v2.0 — base de auditoría técnica, saneamiento y alcance lanzamiento`
- Rama: main

## Pasos para push

### 1. Crear repositorio en GitHub o GitLab

- GitHub: https://github.com/new
- GitLab: https://gitlab.com/projects/new

Crear repositorio **vacío** (sin README, sin .gitignore inicial). Nombre sugerido: `matchprop` o `MatchProp`.

### 2. Conectar origin y push

```bash
cd /Users/arielcarnevali/MatchProp

# Agregar remote (reemplazar TU_USUARIO por tu usuario de GitHub/GitLab)
git remote add origin https://github.com/TU_USUARIO/matchprop.git

# O con SSH
git remote add origin git@github.com:TU_USUARIO/matchprop.git

# Push inicial a rama principal
git push -u origin main
```

### 3. Verificar

```bash
git remote -v
git log --oneline -1
```
