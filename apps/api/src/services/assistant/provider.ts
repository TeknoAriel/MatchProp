import type { SearchFilters } from '@matchprop/shared';

export interface AssistantSearchResponse {
  filters: SearchFilters;
  explanation: string;
  warnings?: string[];
}

export interface AssistantProvider {
  parse(text: string): Promise<AssistantSearchResponse>;
}
