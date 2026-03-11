/**
 * Parse OpenAPI content (JSON or YAML) into a plain object.
 * JSON always supported; YAML if optional dependency "yaml" is present.
 */
export function parseSpecContent(content: string): Record<string, unknown> {
  const trimmed = content.trim();
  if (trimmed.startsWith('{')) {
    return JSON.parse(content) as Record<string, unknown>;
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const yaml = require('yaml');
    return yaml.parse(content) as Record<string, unknown>;
  } catch {
    throw new Error('Invalid OpenAPI: use JSON or install dependency yaml for YAML');
  }
}

export function detectSpecFormat(content: string): 'JSON' | 'YAML' {
  return content.trim().startsWith('{') ? 'JSON' : 'YAML';
}
