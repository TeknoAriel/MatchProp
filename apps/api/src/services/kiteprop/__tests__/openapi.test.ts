/**
 * Unit tests para parseKitepropOpenAPI.
 * Usa fixture local docs/kiteprop-openapi.fixture.json (sin internet).
 */
import { describe, it, expect } from 'vitest';
import { join } from 'path';
import { existsSync, writeFileSync, unlinkSync } from 'fs';
import { tmpdir } from 'os';
import { parseKitepropOpenAPI, suggestTemplateFromSpec } from '../openapi.js';

const candidates = [
  join(process.cwd(), 'docs', 'kiteprop-openapi.fixture.json'),
  join(process.cwd(), '..', 'docs', 'kiteprop-openapi.fixture.json'),
];
const FIXTURE_PATH = candidates.find((p) => existsSync(p)) ?? candidates[0];

describe('parseKitepropOpenAPI', () => {
  it('encuentra endpoint POST /leads desde fixture', () => {
    const config = parseKitepropOpenAPI(FIXTURE_PATH);
    expect(config).not.toBeNull();
    expect(config!.leadCreatePath).toBe('/leads');
    expect(config!.baseUrl).toBe('https://api.kiteprop.com/v1');
  });

  it('extrae auth scheme X-API-Key desde spec', () => {
    const config = parseKitepropOpenAPI(FIXTURE_PATH);
    expect(config).not.toBeNull();
    expect(config!.authHeaderName).toBe('X-API-Key');
    expect(config!.authFormat).toBe('ApiKey');
  });

  it('extrae required fields del requestBody', () => {
    const config = parseKitepropOpenAPI(FIXTURE_PATH);
    expect(config).not.toBeNull();
    expect(config!.requiredFields).toContain('email');
    expect(config!.requiredFields).toContain('listing_id');
  });

  it('retorna null si spec tiene JSON inválido', () => {
    const tmp = join(tmpdir(), `invalid-openapi-${Date.now()}.json`);
    writeFileSync(tmp, 'not valid json {');
    const config = parseKitepropOpenAPI(tmp);
    unlinkSync(tmp);
    expect(config).toBeNull();
  });
});

describe('suggestTemplateFromSpec', () => {
  const minimalSpec = JSON.stringify({
    openapi: '3.0',
    paths: {
      '/leads': {
        post: {
          requestBody: {
            content: {
              'application/json': {
                schema: { required: ['email', 'message', 'listing_id'] },
              },
            },
          },
        },
      },
    },
  });

  it('genera template con placeholders para required fields', () => {
    const template = suggestTemplateFromSpec(minimalSpec);
    const parsed = JSON.parse(template);
    expect(parsed.email).toBe('{{buyer.email}}');
    expect(parsed.message).toBe('{{lead.message}}');
    expect(parsed.listing_id).toBe('{{listing.externalId}}');
  });

  it('retorna {} para contenido inválido', () => {
    expect(suggestTemplateFromSpec('invalid')).toBe('{}');
  });
});
