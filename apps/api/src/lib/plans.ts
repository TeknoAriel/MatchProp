/**
 * Definición única de planes comerciales (precios en centavos USD).
 * Usada por suscripciones, checkout y panel admin.
 */
export const PLANS = {
  BUYER: {
    id: 'BUYER' as const,
    name: 'Usuario',
    description: 'Like y favoritos',
    priceMonthly: 100, // $1 USD
    priceYearly: 1000, // $10 USD (2 meses gratis)
    features: ['Like ilimitados', 'Favoritos ilimitados', 'Alertas básicas'],
  },
  AGENT: {
    id: 'AGENT' as const,
    name: 'Agente',
    description: 'Listas personalizadas',
    priceMonthly: 300,
    priceYearly: 3000,
    features: ['Todo de Usuario', 'Listas personalizadas', 'Exportar listas', 'Alertas avanzadas'],
  },
  REALTOR: {
    id: 'REALTOR' as const,
    name: 'Corredor',
    description: 'Herramientas profesionales',
    priceMonthly: 500,
    priceYearly: 5000,
    features: ['Todo de Agente', 'CRM básico', 'Reportes', 'Soporte prioritario'],
  },
  INMOBILIARIA: {
    id: 'INMOBILIARIA' as const,
    name: 'Inmobiliaria',
    description: 'Para equipos',
    priceMonthly: 1000,
    priceYearly: 10000,
    features: ['Todo de Corredor', 'Gestión de equipo', 'API acceso', 'Descuento 20% para agentes'],
  },
} as const;

export type PlanId = keyof typeof PLANS;

/** 20% dto para AGENT/REALTOR bajo inmobiliaria */
export const ORG_DISCOUNT = 0.2;
