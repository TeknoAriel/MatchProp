import { parseSearchText } from './search-parser.js';
import type { AssistantProvider, AssistantSearchResponse } from './provider.js';

export class DeterministicProvider implements AssistantProvider {
  async parse(text: string): Promise<AssistantSearchResponse> {
    return parseSearchText(text);
  }
}

export function getAssistantProvider(): AssistantProvider {
  return new DeterministicProvider();
}

export { parseSearchText } from './search-parser.js';
export type { AssistantProvider, AssistantSearchResponse } from './provider.js';
