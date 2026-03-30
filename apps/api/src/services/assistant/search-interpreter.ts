import type { AssistantSearchResponse, SearchFilters } from '@matchprop/shared';
import { prisma } from '../../lib/prisma.js';
import { decrypt } from '../../lib/crypto.js';
import { parseSearchText } from './search-parser.js';
import { applyRefinementCommands, mergeCarriedAndParsed } from './search-refinement.js';
import { buildSearchIntent } from './build-search-intent.js';
import {
  completeIntentWithLlm,
  mergeLlmPatchOntoDeterministic,
  type IntentLlmConfig,
} from './intent-llm.js';
import { capSearchFilters } from './search-filter-cap.js';

export async function loadIntentLlmConfig(): Promise<IntentLlmConfig | null> {
  const config = await prisma.assistantConfig.findUnique({ where: { id: 'default' } });
  if (!config?.isEnabled) return null;
  const enc = config.apiKeyEncrypted || config.tokenEncrypted;
  if (!enc) return null;
  let apiKey: string;
  try {
    apiKey = decrypt(enc);
  } catch {
    return null;
  }
  if (!apiKey?.trim()) return null;
  const provider = (config.provider ?? 'openai') as IntentLlmConfig['provider'];
  if (provider === 'anthropic') return null;
  const model =
    (config.model ?? config.conversationalModel ?? 'gpt-4o-mini').trim() || 'gpt-4o-mini';
  return {
    provider,
    apiKey: apiKey.trim(),
    model,
    baseUrl: config.baseUrl,
  };
}

/**
 * Pipeline: refinamiento sobre búsqueda previa → parse determinístico → merge → LLM opcional → SearchIntent.
 */
export async function interpretSearchQuery(opts: {
  text: string;
  previousFilters?: SearchFilters;
  llm: IntentLlmConfig | null;
}): Promise<AssistantSearchResponse> {
  const rawQuery = opts.text.trim();
  const hadPrevious = !!opts.previousFilters && Object.keys(opts.previousFilters).length > 0;

  const carried = hadPrevious
    ? applyRefinementCommands(rawQuery, opts.previousFilters)
    : ({} as SearchFilters);
  const parsed = parseSearchText(rawQuery);
  let filters = mergeCarriedAndParsed(carried, parsed.filters);

  const softSet = new Set<string>(parsed.softPreferences);
  const lifestyle: string[] = [];
  const interpretationNotes: string[] = [];
  let usedLlm = false;

  if (hadPrevious) {
    interpretationNotes.push('Ajusté sobre tu búsqueda anterior.');
  }

  if (opts.llm) {
    const llmOut = await completeIntentWithLlm(opts.llm, rawQuery, filters);
    if (llmOut) {
      usedLlm = true;
      filters = mergeLlmPatchOntoDeterministic(filters, llmOut.filtersPatch);
      for (const s of llmOut.softPreferences) softSet.add(s);
      lifestyle.push(...llmOut.lifestyleSignals);
      interpretationNotes.push(...llmOut.notes);
    }
  }

  filters = capSearchFilters(filters);

  const softPreferences = [...softSet];
  let explanation = parsed.explanation;
  if (interpretationNotes.length) {
    explanation = `${explanation} ${interpretationNotes.join(' ')}`.trim();
  }

  const intent = buildSearchIntent({
    filters,
    rawQuery,
    softPreferences,
    lifestyleSignals: lifestyle,
    interpretationNotes,
    usedLlm,
  });

  return {
    filters,
    explanation,
    warnings: parsed.warnings,
    intent,
  };
}
