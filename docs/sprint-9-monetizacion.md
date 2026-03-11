# Sprint 9 — Monetización

**Objetivo:** Wallet B2B, Premium B2C (Stripe), Payment Adapter, feature flags formales.

---

## Scope

### 1. Feature flags formalizados ✅

- [x] Módulo `config/feature-flags` con DEMO_MODE, demo sources
- [x] Documentar en PROD.md (ya existe)

### 2. Wallet B2B (inmobiliarias) ✅

- [x] Modelo `Wallet` (orgId, balanceCents, currency)
- [x] Modelo `WalletTransaction` (walletId, amount, type, referenceId)
- [x] API: GET /orgs/:id/wallet, POST /orgs/:id/wallet/top-up (owner/org_admin)
- [x] Debit en activación lead: POST /orgs/:orgId/leads/:leadId/activate (paga con wallet)

### 3. Premium B2C (Stripe) ✅

- [x] Stripe SDK, env STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET
- [x] POST /me/checkout-session → Stripe Checkout
- [x] POST /webhooks/stripe → actualizar premiumUntil
- [x] UI: botón "Hacerse Premium" → Checkout (leads + /me/premium)

### 4. Payment Adapter Layer ✅

- [x] Interfaz PaymentProvider (createCheckout, constructWebhookEvent)
- [x] StripeProvider impl (lib/payments/stripe-provider.ts)
- [ ] Mercado Pago (LATAM) — posterior

---

## Gates

- pnpm -r typecheck
- pnpm --filter api test:all
- smoke:ux PASS
