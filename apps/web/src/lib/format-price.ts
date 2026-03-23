/**
 * Formato de precios para publicaciones: miles con punto (.), decimales con coma (,).
 * Monedas: USD, ARS (ARG → ARS), UF, CLP.
 */

export function normalizeListingCurrency(c: string | null | undefined): string {
  if (!c || typeof c !== 'string') return 'USD';
  const u = c.trim().toUpperCase();
  if (u === 'ARG' || u === 'ARS') return 'ARG';
  if (u === 'USD' || u === 'UF' || u === 'CLP') return u;
  return u;
}

function decimalPlaces(currency: string): number {
  switch (currency) {
    case 'CLP':
    case 'ARG':
      return 0;
    case 'UF':
      return 2;
    case 'USD':
    default:
      return 2;
  }
}

/**
 * Solo el monto formateado (sin código de moneda).
 * Miles: punto. Decimales: coma.
 */
export function formatPriceAmount(price: number, currency: string | null | undefined): string {
  const c = normalizeListingCurrency(currency);
  const dec = decimalPlaces(c);
  const n = Number(price);
  if (!Number.isFinite(n)) return '—';
  const rounded = dec === 0 ? Math.round(n) : Number(n.toFixed(dec));
  const negative = rounded < 0;
  const abs = Math.abs(rounded);
  const fixed = abs.toFixed(dec);
  const [intPart, fracPart] = fixed.split('.');
  const intStr = parseInt(intPart!, 10).toString();
  const withDots = intStr.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const body = dec === 0 ? withDots : `${withDots},${fracPart}`;
  return negative ? `-${body}` : body;
}

/** Precio completo para cards: "USD 1.234.567" o "UF 123,45" */
export function formatListingPrice(
  price: number | null | undefined,
  currency: string | null | undefined
): string {
  if (price == null || Number.isNaN(Number(price))) return 'Consultar';
  const c = normalizeListingCurrency(currency);
  return `${c} ${formatPriceAmount(Number(price), c)}`;
}
