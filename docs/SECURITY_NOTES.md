# MatchProp — Notas de seguridad (auditoría)

## Endpoints debug / admin

- **Condición:** Solo disponibles con `DEMO_MODE=1` **o** `NODE_ENV=development`.
- **Rutas afectadas:** `/admin/debug/*` (listings-count, listings/:id/matches, crm-push, crm-push/list, crm-push/:id/resend). En producción (sin demo/dev) deben responder 403 o no exponerse.
- **Auth:** Estos endpoints no requieren JWT; el control es por variable de entorno.

## Secretos

- **No se incluyen en el ZIP de auditoría:** `.env`, `.env.*` están excluidos en `audit-pack.sh`.
- **Variables sensibles:** `CRM_WEBHOOK_SECRET`, `JWT_SECRET`, `AUTH_REFRESH_SECRET`, `INTEGRATIONS_MASTER_KEY`, claves OAuth, etc. El auditor debe usar valores dummy o `.env.example`; nunca commitear valores reales.

## Resumen

- Endpoints debug/admin: solo DEMO_MODE o NODE_ENV=development.
- ZIP de auditoría: sin archivos `.env` ni secretos; sin `node_modules` ni builds.
