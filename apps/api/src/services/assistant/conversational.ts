/**
 * Servicio conversacional: conecta OpenAI, Anthropic, Azure o custom.
 * Usa fetch sin dependencias extra.
 */

export type ConversationalProvider = 'openai' | 'anthropic' | 'azure' | 'custom';

export interface ConversationalConfig {
  provider: ConversationalProvider;
  apiKey: string;
  model: string;
  baseUrl?: string | null;
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface ConversationalResult {
  reply: string;
  model: string;
  error?: string;
}

const OPENAI_BASE = 'https://api.openai.com';
const ANTHROPIC_BASE = 'https://api.anthropic.com';

export async function chatCompletion(
  config: ConversationalConfig,
  message: string,
  history: ChatMessage[] = []
): Promise<ConversationalResult> {
  const messages: ChatMessage[] = [
    ...history.map((h) => ({
      role: h.role as 'user' | 'assistant' | 'system',
      content: h.content,
    })),
    { role: 'user', content: message },
  ];

  if (config.provider === 'anthropic') {
    return chatAnthropic(config, messages);
  }
  return chatOpenAICompatible(config, messages);
}

async function chatOpenAICompatible(
  config: ConversationalConfig,
  messages: ChatMessage[]
): Promise<ConversationalResult> {
  const base = config.baseUrl?.trim() || OPENAI_BASE;
  const url = `${base.replace(/\/$/, '')}/v1/chat/completions`;

  const body = {
    model: config.model,
    messages: messages.map((m) => ({ role: m.role, content: m.content })),
    max_tokens: 1024,
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    return {
      reply: '',
      model: config.model,
      error: `API error ${res.status}: ${text.slice(0, 300)}`,
    };
  }

  const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const content = json.choices?.[0]?.message?.content ?? '';
  return { reply: content.trim(), model: config.model };
}

async function chatAnthropic(
  config: ConversationalConfig,
  messages: ChatMessage[]
): Promise<ConversationalResult> {
  const base = config.baseUrl?.trim() || ANTHROPIC_BASE;
  const url = `${base.replace(/\/$/, '')}/v1/messages`;

  // Anthropic: system opcional, messages alternan user/assistant
  const system =
    messages.find((m) => m.role === 'system')?.content ??
    'Eres un asistente inmobiliario amable y útil.';
  const turnMessages = messages.filter((m) => m.role !== 'system');

  const body = {
    model: config.model,
    max_tokens: 1024,
    system,
    messages: turnMessages.map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    })),
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': config.apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    return {
      reply: '',
      model: config.model,
      error: `Anthropic API error ${res.status}: ${text.slice(0, 300)}`,
    };
  }

  const json = (await res.json()) as {
    content?: { type: string; text?: string }[];
  };
  const block = json.content?.find((c) => c.type === 'text');
  const content = (block as { text?: string })?.text ?? '';
  return { reply: content.trim(), model: config.model };
}
