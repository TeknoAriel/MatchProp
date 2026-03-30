/**
 * Capa opcional LLM (OpenAI-compatible JSON) para completar intención cuando hay API key en AssistantConfig.
 * No reemplaza reglas: solo rellena huecos y añade notas/soft signals.
 */
import { searchFiltersSchema } from '../../schemas/search.js';
import { canonicalizeAmenityToken, listCanonicalAmenityKeys } from '../../lib/amenity-filter.js';
import type { SearchFilters } from '@matchprop/shared';

const VALID_PT = ['HOUSE', 'APARTMENT', 'LAND', 'OFFICE', 'OTHER'] as const;

export type IntentLlmConfig = {
  provider: 'openai' | 'anthropic' | 'azure' | 'custom';
  apiKey: string;
  model: string;
  baseUrl?: string | null;
};

export type LlmIntentResult = {
  filtersPatch: Partial<SearchFilters>;
  softPreferences: string[];
  lifestyleSignals: string[];
  notes: string[];
  confidenceDelta: number;
};

function safeParseJsonObject(raw: string): Record<string, unknown> | null {
  const t = raw.trim();
  const start = t.indexOf('{');
  const end = t.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(t.slice(start, end + 1)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function normalizePatch(obj: Record<string, unknown>): Partial<SearchFilters> {
  const candidate = {
    operationType: obj.operationType,
    propertyType: obj.propertyType,
    priceMin: obj.priceMin,
    priceMax: obj.priceMax,
    currency: obj.currency,
    bedroomsMin: obj.bedroomsMin,
    bedroomsMax: obj.bedroomsMax,
    bathroomsMin: obj.bathroomsMin,
    bathroomsMax: obj.bathroomsMax,
    areaMin: obj.areaMin,
    areaMax: obj.areaMax,
    locationText: obj.locationText,
    amenities: obj.amenities,
    keywords: obj.keywords,
    sortBy: obj.sortBy,
  };
  const parsed = searchFiltersSchema.partial().safeParse(candidate);
  if (!parsed.success) return {};
  const out = parsed.data as Partial<SearchFilters>;
  if (out.propertyType?.length) {
    out.propertyType = out.propertyType.filter((p): p is string =>
      (VALID_PT as readonly string[]).includes(p)
    );
    if (!out.propertyType.length) delete out.propertyType;
  }
  if (out.amenities?.length) {
    out.amenities = [...new Set(out.amenities.map((a) => canonicalizeAmenityToken(String(a))))];
  }
  return out;
}

export function mergeLlmPatchOntoDeterministic(
  base: SearchFilters,
  patch: Partial<SearchFilters>
): SearchFilters {
  const out: SearchFilters = { ...base };
  const filled = (v: unknown) =>
    v !== undefined &&
    v !== null &&
    !(typeof v === 'string' && !v.trim()) &&
    !(Array.isArray(v) && v.length === 0);

  for (const [k, v] of Object.entries(patch)) {
    if (!filled(v)) continue;
    if (k === 'amenities' && Array.isArray(v)) {
      out.amenities = [
        ...new Set([...(out.amenities ?? []), ...v.map((x) => canonicalizeAmenityToken(String(x)))]),
      ];
      continue;
    }
    const cur = (out as Record<string, unknown>)[k];
    if (cur === undefined || cur === null || (Array.isArray(cur) && cur.length === 0)) {
      (out as Record<string, unknown>)[k] = v;
    }
  }
  return out;
}

export async function completeIntentWithLlm(
  config: IntentLlmConfig,
  userText: string,
  deterministicFilters: SearchFilters
): Promise<LlmIntentResult | null> {
  if (config.provider === 'anthropic') {
    return null;
  }

  const amenityKeys = listCanonicalAmenityKeys().slice(0, 80).join(', ');
  const system = `Sos un extractor de intención inmobiliaria para Argentina. Respondé SOLO un JSON válido sin markdown.
Tu trabajo es completar TODO lo que el usuario mencionó y las reglas aún no llenaron: precio (min/max/moneda), tipo(s) de propiedad, dormitorios/baños, m², zona o ciudad (locationText), amenities del listado canónico, palabras clave (keywords), orden (sortBy).
Campos opcionales en filtersPatch (solo si el texto lo justifica y no contradice hechos ya extraídos por reglas):
- operationType: "SALE" | "RENT"
- propertyType: array de ["HOUSE","APARTMENT","LAND","OFFICE","OTHER"]
- priceMin, priceMax: números
- currency: "USD" | "ARS"
- bedroomsMin, bedroomsMax, bathroomsMin, bathroomsMax: enteros
- areaMin, areaMax: enteros (m²)
- locationText: string corta
- amenities: array de strings; usá claves canónicas como: ${amenityKeys}
- keywords: array corto para buscar en título/descripcion
- sortBy: "date_desc"|"price_asc"|"price_desc"|"area_desc"

Reglas:
- Revisá el texto completo (incluso listas largas) y rellená cada criterio mencionado una sola vez en filtersPatch.
- Si el usuario dice "mi casa", "mudarme", "comprar" → SALE salvo que pida alquiler explícito.
- "invertir" + terreno/lote → propertyType puede incluir LAND.
- No inventes precios si no hay números.
- Si nombra una ciudad o barrio y locationText sigue vacío en el borrador, ponelos en locationText.
- softPreferences: array de strings (ej. "familiar", "luminoso") — no son filtros SQL.
- lifestyleSignals: sinónimos de contexto (ej. "niños", "inversión").
- notes: 1-3 frases en español para mostrar al usuario cómo interpretaste (explicabilidad).
- confidenceDelta: número entre -0.1 y 0.15 según tu certeza vs ambigüedad.

JSON shape:
{"filtersPatch":{},"softPreferences":[],"lifestyleSignals":[],"notes":[],"confidenceDelta":0}`;

  const userPayload = JSON.stringify({
    userText,
    deterministicDraft: deterministicFilters,
  });

  const base = config.baseUrl?.trim() || 'https://api.openai.com';
  const url = `${base.replace(/\/$/, '')}/v1/chat/completions`;
  const body = {
    model: config.model,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: userPayload },
    ],
    max_tokens: 1024,
    temperature: 0.2,
    response_format: { type: 'json_object' },
  };

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const content = json.choices?.[0]?.message?.content ?? '';
    const obj = safeParseJsonObject(content);
    if (!obj) return null;
    const filtersPatch = normalizePatch((obj.filtersPatch as Record<string, unknown>) ?? {});
    const softPreferences = Array.isArray(obj.softPreferences)
      ? obj.softPreferences.filter((x): x is string => typeof x === 'string').slice(0, 12)
      : [];
    const lifestyleSignals = Array.isArray(obj.lifestyleSignals)
      ? obj.lifestyleSignals.filter((x): x is string => typeof x === 'string').slice(0, 12)
      : [];
    const notes = Array.isArray(obj.notes)
      ? obj.notes.filter((x): x is string => typeof x === 'string').slice(0, 5)
      : [];
    const cd = obj.confidenceDelta;
    const confidenceDelta =
      typeof cd === 'number' && Number.isFinite(cd) ? Math.max(-0.15, Math.min(0.15, cd)) : 0;
    return { filtersPatch, softPreferences, lifestyleSignals, notes, confidenceDelta };
  } catch {
    return null;
  }
}
