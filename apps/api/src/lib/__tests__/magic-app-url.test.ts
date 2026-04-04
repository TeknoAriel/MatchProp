import { describe, it, expect, afterEach } from 'vitest';
import { resolveMagicAppBaseUrl } from '../magic-app-url.js';

const ORIGINAL_NODE_ENV = process.env.NODE_ENV;

afterEach(() => {
  process.env.NODE_ENV = ORIGINAL_NODE_ENV;
});

describe('resolveMagicAppBaseUrl', () => {
  it('sin Origin usa appUrl del cfg', () => {
    expect(
      resolveMagicAppBaseUrl(
        { headers: {} },
        { appUrl: 'https://prod.example.com', corsOrigins: ['http://localhost:3000'] }
      )
    ).toBe('https://prod.example.com');
  });

  it('Origin 127.0.0.1 gana sobre APP_URL de prod (CORS)', () => {
    process.env.NODE_ENV = 'development';
    expect(
      resolveMagicAppBaseUrl(
        { headers: { origin: 'http://127.0.0.1:3000' } },
        {
          appUrl: 'https://match-prop-web.vercel.app',
          corsOrigins: ['http://localhost:3000', 'http://127.0.0.1:3000'],
        }
      )
    ).toBe('http://127.0.0.1:3000');
  });

  it('localhost en dev sin estar en CORS explícito: isLocalDev', () => {
    process.env.NODE_ENV = 'development';
    expect(
      resolveMagicAppBaseUrl(
        { headers: { origin: 'http://localhost:5173' } },
        { appUrl: 'https://canonical.app', corsOrigins: ['https://canonical.app'] }
      )
    ).toBe('http://localhost:5173');
  });

  it('Origin no permitido y no localhost en prod → fallback', () => {
    process.env.NODE_ENV = 'production';
    expect(
      resolveMagicAppBaseUrl(
        { headers: { origin: 'https://evil.phishing' } },
        { appUrl: 'https://canonical.app', corsOrigins: ['https://canonical.app'] }
      )
    ).toBe('https://canonical.app');
  });
});
