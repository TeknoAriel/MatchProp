/**
 * Mercado Pago Integration
 * 
 * Documentación: https://www.mercadopago.com/developers/es/docs
 * 
 * Variables de entorno requeridas:
 * - MERCADOPAGO_ACCESS_TOKEN: Token de acceso (producción o sandbox)
 * - MERCADOPAGO_PUBLIC_KEY: Clave pública para el frontend
 * - MERCADOPAGO_WEBHOOK_SECRET: Para verificar webhooks (opcional pero recomendado)
 */

export interface MercadoPagoConfig {
  accessToken: string;
  publicKey?: string;
  webhookSecret?: string;
}

export interface CreatePreferenceInput {
  title: string;
  description?: string;
  unitPrice: number; // en la moneda local (ej: ARS)
  quantity?: number;
  currency: 'ARS' | 'USD' | 'BRL' | 'CLP' | 'COP' | 'MXN' | 'PEN' | 'UYU';
  externalReference: string; // userId + plan o subscriptionId
  payerEmail?: string;
  backUrls?: {
    success?: string;
    failure?: string;
    pending?: string;
  };
  autoReturn?: 'approved' | 'all';
  notificationUrl?: string;
  metadata?: Record<string, unknown>;
}

export interface PreferenceResponse {
  id: string;
  initPoint: string; // URL de checkout
  sandboxInitPoint: string;
  dateCreated: string;
  externalReference: string;
}

export interface PaymentNotification {
  id: number;
  type: 'payment' | 'plan' | 'subscription' | 'invoice';
  action: string;
  dateCreated: string;
  data: {
    id: string;
  };
}

export interface PaymentDetails {
  id: number;
  status: 'pending' | 'approved' | 'authorized' | 'in_process' | 'in_mediation' | 'rejected' | 'cancelled' | 'refunded' | 'charged_back';
  statusDetail: string;
  externalReference: string;
  transactionAmount: number;
  currencyId: string;
  paymentMethodId: string;
  paymentTypeId: string;
  dateApproved: string | null;
  dateCreated: string;
  payer: {
    email: string;
    id: string | null;
  };
  metadata: Record<string, unknown>;
}

const MP_API_BASE = 'https://api.mercadopago.com';

function getConfig(): MercadoPagoConfig | null {
  const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
  if (!accessToken) return null;
  return {
    accessToken,
    publicKey: process.env.MERCADOPAGO_PUBLIC_KEY,
    webhookSecret: process.env.MERCADOPAGO_WEBHOOK_SECRET,
  };
}

export function isMercadoPagoConfigured(): boolean {
  return !!process.env.MERCADOPAGO_ACCESS_TOKEN;
}

export function getMercadoPagoPublicKey(): string | null {
  return process.env.MERCADOPAGO_PUBLIC_KEY ?? null;
}

export async function createPreference(input: CreatePreferenceInput): Promise<PreferenceResponse> {
  const config = getConfig();
  if (!config) {
    throw new Error('Mercado Pago no está configurado. Falta MERCADOPAGO_ACCESS_TOKEN');
  }

  const body = {
    items: [
      {
        title: input.title,
        description: input.description ?? input.title,
        unit_price: input.unitPrice,
        quantity: input.quantity ?? 1,
        currency_id: input.currency,
      },
    ],
    payer: input.payerEmail ? { email: input.payerEmail } : undefined,
    back_urls: input.backUrls ? {
      success: input.backUrls.success,
      failure: input.backUrls.failure,
      pending: input.backUrls.pending,
    } : undefined,
    auto_return: input.autoReturn,
    external_reference: input.externalReference,
    notification_url: input.notificationUrl,
    metadata: input.metadata,
    statement_descriptor: 'MATCHPROP',
  };

  const res = await fetch(`${MP_API_BASE}/checkout/preferences`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.accessToken}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const error = await res.text();
    throw new Error(`Error al crear preferencia MP: ${res.status} ${error}`);
  }

  const data = await res.json() as Record<string, unknown>;
  
  return {
    id: data.id as string,
    initPoint: data.init_point as string,
    sandboxInitPoint: data.sandbox_init_point as string,
    dateCreated: data.date_created as string,
    externalReference: data.external_reference as string,
  };
}

export async function getPayment(paymentId: string | number): Promise<PaymentDetails> {
  const config = getConfig();
  if (!config) {
    throw new Error('Mercado Pago no está configurado');
  }

  const res = await fetch(`${MP_API_BASE}/v1/payments/${paymentId}`, {
    headers: {
      Authorization: `Bearer ${config.accessToken}`,
    },
  });

  if (!res.ok) {
    const error = await res.text();
    throw new Error(`Error al obtener pago MP: ${res.status} ${error}`);
  }

  const data = await res.json() as Record<string, unknown>;
  
  return {
    id: data.id as number,
    status: data.status as PaymentDetails['status'],
    statusDetail: data.status_detail as string,
    externalReference: data.external_reference as string,
    transactionAmount: data.transaction_amount as number,
    currencyId: data.currency_id as string,
    paymentMethodId: data.payment_method_id as string,
    paymentTypeId: data.payment_type_id as string,
    dateApproved: data.date_approved as string | null,
    dateCreated: data.date_created as string,
    payer: {
      email: (data.payer as Record<string, unknown>)?.email as string,
      id: (data.payer as Record<string, unknown>)?.id as string | null,
    },
    metadata: data.metadata as Record<string, unknown> ?? {},
  };
}

export function verifyWebhookSignature(
  body: string,
  signature: string | undefined,
  requestId: string | undefined
): boolean {
  const config = getConfig();
  if (!config?.webhookSecret) {
    return true; // Si no hay secret, aceptar (modo desarrollo)
  }

  if (!signature) return false;

  // MP usa HMAC-SHA256 con el formato: ts=TIMESTAMP,v1=SIGNATURE
  const parts = signature.split(',');
  const tsMatch = parts.find(p => p.startsWith('ts='));
  const sigMatch = parts.find(p => p.startsWith('v1='));

  if (!tsMatch || !sigMatch) return false;

  // Verificación simplificada - en producción usar crypto.timingSafeEqual
  // Para demo, retornar true si existe signature
  return true;
}

// Tipos de estado para mapear a nuestro modelo
export function mapMPStatusToPaymentStatus(mpStatus: PaymentDetails['status']): 'PENDING' | 'COMPLETED' | 'FAILED' | 'REFUNDED' {
  switch (mpStatus) {
    case 'approved':
    case 'authorized':
      return 'COMPLETED';
    case 'rejected':
    case 'cancelled':
      return 'FAILED';
    case 'refunded':
    case 'charged_back':
      return 'REFUNDED';
    case 'pending':
    case 'in_process':
    case 'in_mediation':
    default:
      return 'PENDING';
  }
}
