import { describe, it, expect } from 'vitest';
import { encodeCursor, decodeCursor } from '../cursor.js';

describe('decodeCursor', () => {
  it('cursor string > 256 rechaza', () => {
    const long = 'a'.repeat(257);
    expect(decodeCursor(long)).toBeNull();
  });

  it('id > 50 rechaza', () => {
    const payload = { createdAt: '2024-01-01T00:00:00.000Z', id: 'x'.repeat(51) };
    const b64 = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64');
    const cursor = b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    expect(decodeCursor(cursor)).toBeNull();
  });

  it('base64 inválido rechaza', () => {
    expect(decodeCursor('!!!invalid!!!')).toBeNull();
  });

  it('JSON inválido rechaza', () => {
    const badB64 = Buffer.from('{invalid json}', 'utf8').toString('base64url');
    expect(decodeCursor(badB64)).toBeNull();
  });

  it('cursor vacío o undefined rechaza', () => {
    expect(decodeCursor('')).toBeNull();
    expect(decodeCursor(undefined)).toBeNull();
    expect(decodeCursor('   ')).toBeNull();
  });

  it('cursor válido roundtrip conserva createdAt e id', () => {
    const createdAt = new Date('2024-06-15T12:00:00.000Z');
    const id = 'prop_abc123';
    const encoded = encodeCursor({ createdAt, id });
    const decoded = decodeCursor(encoded);
    expect(decoded).not.toBeNull();
    expect(decoded!.id).toBe(id);
    expect(decoded!.createdAt.getTime()).toBe(createdAt.getTime());
  });

  it('cursor válido 256 chars acepta', () => {
    const id = 'x'.repeat(50);
    const encoded = encodeCursor({ createdAt: new Date(), id });
    expect(encoded.length).toBeLessThanOrEqual(256);
    const decoded = decodeCursor(encoded);
    expect(decoded).not.toBeNull();
    expect(decoded!.id).toBe(id);
  });
});
