/**
 * Simple template renderer for Kiteprop payload.
 * Replaces {{path}} with values from context. Missing => ''.
 */
export type PayloadTemplateContext = {
  buyer: { email: string; id: string };
  lead: { message: string | null; id: string };
  listing: {
    id: string;
    externalId: string;
    title: string | null;
    price: number | null;
    currency: string | null;
    url?: string;
  };
};

const PLACEHOLDER = '';

/** Para PENDING: reemplaza buyer.email, buyer.phone, buyer.name con '' (sin PII). */
export function renderPayloadTemplatePending(
  template: string,
  context: PayloadTemplateContext
): Record<string, unknown> {
  const get = (path: string): string => {
    if (/^buyer\.(email|phone|name)/i.test(path)) return PLACEHOLDER;
    const parts = path.trim().split('.');
    let v: unknown = context as unknown;
    for (const p of parts) {
      if (v == null || typeof v !== 'object') return PLACEHOLDER;
      v = (v as Record<string, unknown>)[p];
    }
    if (v === null || v === undefined) return PLACEHOLDER;
    return String(v);
  };

  const escapeForJsonString = (s: string) => s.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  const replacer = (_match: string, path: string) => escapeForJsonString(get(path));

  let out = template;
  const re = /\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g;
  out = out.replace(re, replacer);

  try {
    return JSON.parse(out) as Record<string, unknown>;
  } catch {
    return {};
  }
}

export function renderPayloadTemplate(
  template: string,
  context: PayloadTemplateContext
): Record<string, unknown> {
  const get = (path: string): string => {
    const parts = path.trim().split('.');
    let v: unknown = context as unknown;
    for (const p of parts) {
      if (v == null || typeof v !== 'object') return PLACEHOLDER;
      v = (v as Record<string, unknown>)[p];
    }
    if (v === null || v === undefined) return PLACEHOLDER;
    return String(v);
  };

  const escapeForJsonString = (s: string) => s.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  const replacer = (_match: string, path: string) => escapeForJsonString(get(path));

  let out = template;
  const re = /\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g;
  while (re.test(out)) {
    out = out.replace(re, replacer);
  }

  try {
    return JSON.parse(out) as Record<string, unknown>;
  } catch {
    return {};
  }
}
