# Fase 4 — Monetización (E7)

**Objetivo:** Wallet B2B (inmobiliarias) y Premium B2C (Stripe). Estado actual y tareas para cerrar.

---

## 1. Premium B2C (Stripe) — estado actual

### Ya implementado

| Componente                     | Ubicación                                          | Descripción                                                                                                             |
| ------------------------------ | -------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| **POST /me/checkout-session**  | `apps/api/src/routes/stripe.ts`                    | Crea Stripe Checkout Session; redirige a Stripe. Requiere STRIPE_SECRET_KEY.                                            |
| **POST /webhooks/stripe**      | Idem                                               | Webhook: `checkout.session.completed` → actualiza `User.premiumUntil`. Verificación de firma con STRIPE_WEBHOOK_SECRET. |
| **User.premiumUntil**          | Prisma schema                                      | Campo en User; si `premiumUntil > now` el usuario es premium.                                                           |
| **featureFlags.stripePremium** | `apps/api/src/config.ts`                           | `true` si STRIPE_SECRET_KEY está definido.                                                                              |
| **/me/premium**                | `apps/web/src/app/me/premium/page.tsx`             | Página "Hacerse Premium" con CTA y texto de suscripción.                                                                |
| **HacersePremiumButton**       | `apps/web/src/components/HacersePremiumButton.tsx` | Llama POST /me/checkout-session y redirige a `data.url` (Stripe).                                                       |

### Variables de entorno (PROD)

- **STRIPE_SECRET_KEY** — clave secreta Stripe (modo live en prod).
- **STRIPE_WEBHOOK_SECRET** — secret del webhook en Stripe Dashboard (endpoint `POST /api/webhooks/stripe`).
- **STRIPE_PRICE_ID** (opcional) — default `price_premium_monthly`; ID del precio en Stripe.

### Tareas pendientes (opcional)

- [ ] Crear producto y precio en Stripe Dashboard y configurar STRIPE_PRICE_ID.
- [ ] Registrar URL de webhook en Stripe (ej. `https://api.tudominio.com/webhooks/stripe`).
- [ ] Probar flujo completo: Clic "Hacerse Premium" → Checkout → pago test → redirect → premiumUntil actualizado.
- [ ] Mostrar estado premium en header/nav (ya hay link "Premium" en layout).

---

## 2. Wallet B2B (inmobiliarias) — estado actual

### Modelo de datos (Prisma)

- **Organization** — id, name, slug; relación 1:1 con **Wallet**.
- **Wallet** — id, orgId, balanceCents, currency (default ARS); relación con **WalletTransaction**.
- **WalletTransaction** — id, walletId, amountCents, type (TOP_UP | DEBIT | REFUND), referenceId (Stripe payment id, lead id, etc.).
- **OrgMember** — orgId, userId, role (owner | org_admin | agent).

### Ya usado en código

- **LEAD_DEBIT_CENTS** (config) — débito por activar lead (centavos); usado en `apps/api/src/routes/orgs.ts` para débito al activar lead (línea 369: `config.leadDebitCents`).

### Pendiente para Wallet B2B completo

- [ ] **API GET /orgs/:orgId/wallet** — ver balance (solo miembros de la org). Opcional: GET /me/wallet si el usuario tiene una org.
- [ ] **API POST /orgs/:orgId/wallet/top-up** — recarga (ej. vía Stripe); crear WalletTransaction type TOP_UP y actualizar Wallet.balanceCents.
- [ ] **Débito al activar lead:** ya existe lógica en orgs (leadDebitCents); asegurar que se cree WalletTransaction type DEBIT y se reste de Wallet.
- [ ] **UI:** pantalla "Mi organización" o "Wallet" para org_admin/owner: ver balance, historial de transacciones, botón "Recargar" (Stripe Checkout para B2B).

### Referencia

- `apps/api/prisma/schema.prisma` — modelos Organization, Wallet, WalletTransaction, OrgMember.
- `apps/api/src/routes/orgs.ts` — rutas de organizaciones; `config.leadDebitCents` usado en activación de lead.

---

## 3. Resumen

| Línea          | Estado                            | Acción                                                                          |
| -------------- | --------------------------------- | ------------------------------------------------------------------------------- |
| **Stripe B2C** | ~90%                              | Configurar Stripe Dashboard (producto, precio, webhook) y probar flujo.         |
| **Wallet B2B** | Modelo listo, débito referenciado | Exponer API wallet (balance, top-up, transacciones) y UI "Wallet" / "Recargar". |

---

_Doc creado a partir de plan-completamiento-100.md Fase 4. Actualizar al implementar cada ítem._
