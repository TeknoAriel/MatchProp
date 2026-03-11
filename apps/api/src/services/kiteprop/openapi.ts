import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { parseSpecContent } from './spec-store.js';

export type KitepropOpenAPIConfig = {
  baseUrl: string;
  leadCreatePath: string;
  authHeaderName: string;
  authFormat: 'Bearer' | 'ApiKey';
  requiredFields: string[];
};

const LEAD_KEYWORDS = ['lead', 'leads', 'consulta', 'consultas', 'contact', 'contactos'];

function pathMatchesLead(path: string, method: string): boolean {
  const lower = path.toLowerCase();
  return method === 'POST' && LEAD_KEYWORDS.some((kw) => lower.includes(kw));
}

function getAuthFromSpec(spec: {
  components?: { securitySchemes?: Record<string, unknown> };
  security?: Array<Record<string, string[]>>;
}): { headerName: string; format: 'Bearer' | 'ApiKey' } {
  const schemes = spec.components?.securitySchemes as
    | Record<string, { type?: string; in?: string; name?: string; scheme?: string }>
    | undefined;
  const security = spec.security?.[0];
  if (security) {
    const schemeName = Object.keys(security)[0] as string | undefined;
    const scheme = schemeName ? schemes?.[schemeName] : undefined;
    if (scheme?.type === 'apiKey' && scheme.in === 'header' && scheme.name) {
      return { headerName: scheme.name, format: 'ApiKey' };
    }
    if (scheme?.type === 'http' && scheme.scheme === 'bearer') {
      return { headerName: 'Authorization', format: 'Bearer' };
    }
  }
  return { headerName: 'X-API-Key', format: 'ApiKey' };
}

function configFromSpec(spec: Record<string, unknown>): KitepropOpenAPIConfig | null {
  const pathsObj = spec.paths as Record<string, Record<string, unknown>> | undefined;
  if (!pathsObj) return null;

  let bestPath: string | null = null;
  let bestRequired: string[] = [];
  for (const [path, methods] of Object.entries(pathsObj)) {
    const post = methods.post as Record<string, unknown> | undefined;
    if (!post || !pathMatchesLead(path, 'POST')) continue;
    const body = post.requestBody as
      | {
          content?: { 'application/json'?: { schema?: { required?: string[] } } };
        }
      | undefined;
    const required = body?.content?.['application/json']?.schema?.required ?? [];
    if (!bestPath || required.length > bestRequired.length) {
      bestPath = path;
      bestRequired = required;
    }
  }
  if (!bestPath) return null;

  const servers = spec.servers as Array<{ url: string }> | undefined;
  const baseUrl = servers?.[0]?.url?.replace(/\/$/, '') ?? 'https://api.kiteprop.com/v1';
  const auth = getAuthFromSpec(spec as Parameters<typeof getAuthFromSpec>[0]);

  return {
    baseUrl,
    leadCreatePath: bestPath.startsWith('/') ? bestPath : `/${bestPath}`,
    authHeaderName: auth.headerName,
    authFormat: auth.format,
    requiredFields: bestRequired.length > 0 ? bestRequired : ['email', 'message', 'listing_id'],
  };
}

const FIELD_TO_PLACEHOLDER: Record<string, string> = {
  email: '{{buyer.email}}',
  name: '{{buyer.email}}',
  message: '{{lead.message}}',
  msg: '{{lead.message}}',
  body: '{{lead.message}}',
  listing_id: '{{listing.externalId}}',
  listingId: '{{listing.externalId}}',
  listing_title: '{{listing.title}}',
  title: '{{listing.title}}',
  price: '{{listing.price}}',
  currency: '{{listing.currency}}',
  lead_id: '{{lead.id}}',
};

/** Build suggested payload template JSON from spec required fields. */
export function suggestTemplateFromSpec(content: string): string {
  try {
    const spec = parseSpecContent(content);
    const config = configFromSpec(spec);
    if (!config?.requiredFields?.length) return '{}';
    const required = config.requiredFields;
    const obj: Record<string, string> = {};
    for (const field of required) {
      const key = field.trim();
      if (!key) continue;
      const placeholder =
        FIELD_TO_PLACEHOLDER[key] ?? FIELD_TO_PLACEHOLDER[key.toLowerCase()] ?? `{{${key}}}`;
      obj[key] = placeholder;
    }
    return JSON.stringify(obj, null, 2);
  } catch {
    return '{}';
  }
}

/** Parse OpenAPI from string content (JSON or YAML). */
export function parseKitepropOpenAPIFromContent(content: string): KitepropOpenAPIConfig | null {
  try {
    const spec = parseSpecContent(content);
    return configFromSpec(spec);
  } catch {
    return null;
  }
}

export function parseKitepropOpenAPI(specPath?: string): KitepropOpenAPIConfig | null {
  const paths = [
    specPath,
    join(process.cwd(), '..', '..', 'docs', 'kiteprop-openapi.json'),
    join(process.cwd(), 'docs', 'kiteprop-openapi.json'),
    join(process.cwd(), '..', '..', 'docs', 'kiteprop-openapi.fixture.json'),
  ].filter(Boolean) as string[];

  let raw: string | null = null;
  for (const p of paths) {
    if (existsSync(p)) {
      raw = readFileSync(p, 'utf-8');
      break;
    }
  }
  if (!raw) return null;

  let spec: Record<string, unknown>;
  try {
    spec = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return null;
  }

  return configFromSpec(spec);
}
