/**
 * Sprint 9: Payment Adapter Layer.
 * Interfaz para proveedores de pago (Stripe, Mercado Pago, etc.).
 */

export interface CheckoutSessionInput {
  userId: string;
  customerEmail?: string;
  successUrl: string;
  cancelUrl: string;
  priceId?: string;
  /** Stripe coupon ID para 20% descuento (agente/corredor en inmobiliaria) */
  couponId?: string;
}

export interface CheckoutSessionResult {
  url: string;
  sessionId: string;
}

export interface WebhookEvent {
  type: string;
  data: { object: Record<string, unknown> };
}

export interface PaymentProvider {
  createCheckoutSession(input: CheckoutSessionInput): Promise<CheckoutSessionResult>;
  constructWebhookEvent(
    payload: Buffer,
    signature: string,
    secret: string
  ): Promise<WebhookEvent | null>;
  readonly name: string;
}
