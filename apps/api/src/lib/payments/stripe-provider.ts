/**
 * Sprint 9: Stripe implementation del PaymentProvider.
 */
import Stripe from 'stripe';
import type {
  PaymentProvider,
  CheckoutSessionInput,
  CheckoutSessionResult,
  WebhookEvent,
} from './types.js';

export function createStripeProvider(secretKey: string): PaymentProvider {
  const stripe = new Stripe(secretKey);

  return {
    name: 'stripe',

    async createCheckoutSession(input: CheckoutSessionInput): Promise<CheckoutSessionResult> {
      const priceId = input.priceId ?? 'price_premium_monthly';
      const params: Stripe.Checkout.SessionCreateParams = {
        mode: 'subscription',
        line_items: [{ price: priceId, quantity: 1 }],
        success_url: input.successUrl,
        cancel_url: input.cancelUrl,
        client_reference_id: input.userId,
        customer_email: input.customerEmail,
      };
      if (input.couponId) {
        params.discounts = [{ coupon: input.couponId }];
      }
      const session = await stripe.checkout.sessions.create(params);
      return {
        url: session.url ?? '',
        sessionId: session.id,
      };
    },

    async constructWebhookEvent(
      payload: Buffer,
      signature: string,
      secret: string
    ): Promise<WebhookEvent | null> {
      try {
        const event = stripe.webhooks.constructEvent(payload, signature, secret);
        return {
          type: event.type,
          data: { object: event.data.object as Record<string, unknown> },
        };
      } catch {
        return null;
      }
    },
  };
}
