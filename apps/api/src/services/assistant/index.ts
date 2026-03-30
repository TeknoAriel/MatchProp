import type { AssistantProvider, AssistantSearchResponse } from './provider.js';
import { interpretSearchQuery } from './search-interpreter.js';

export class DeterministicProvider implements AssistantProvider {
  async parse(text: string): Promise<AssistantSearchResponse> {
    return interpretSearchQuery({ text, llm: null });
  }
}

/** @deprecated Prefer interpretSearchQuery + loadIntentLlmConfig en la ruta */
export function getAssistantProvider(): AssistantProvider {
  return new DeterministicProvider();
}

export { parseSearchText } from './search-parser.js';
export { interpretSearchQuery, loadIntentLlmConfig } from './search-interpreter.js';
export type { AssistantProvider, AssistantSearchResponse } from './provider.js';
