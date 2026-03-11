# MatchProp v2.0 — Flujo Demo Comercial

## Flujo verificable

1. **Usuario crea o ajusta perfil**
   - Login: http://localhost:3000/login
   - Usar smoke-ux@matchprop.com → "Abrir link de acceso (dev)"
   - Perfil: /me/profile

2. **Recibe propiedades relevantes**
   - Asistente: /assistant — ingresar texto "depto 2 dorm Palermo hasta 150k"
   - Ver resultados y guardar búsqueda
   - Feed: /feed o /feed/list

3. **Guarda / descarta / marca interés**
   - Swipe LIKE → va a Mis like (LATER)
   - Swipe NOPE → descarta
   - "Me interesa" (Quiero que me contacten) → crea lead PENDING

4. **Lead pending**
   - Ver en /leads
   - Estado PENDING

5. **Activar a active**
   - Admin o premium: activar lead
   - O usar /demo → "Crear escenario demo" para simular ACTIVE

6. **Admin puede visualizar**
   - Levantar admin: `pnpm dev:admin`
   - http://localhost:3002
   - Leads, propiedades, crm-push, match-events

## Comando para levantar todo

```bash
pnpm start
```

## Beta fundadora

- DEMO_MODE=1: sin restricciones premium por tiempo limitado
- Configuración preparada para futura monetización vía feature flags
