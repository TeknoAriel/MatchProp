import { describe, it, expect } from 'vitest';
import { renderPayloadTemplate } from '../payload-template.js';

describe('renderPayloadTemplate', () => {
  const context = {
    buyer: { email: 'user@test.com', id: 'uid-1' },
    lead: { message: 'Hola, me interesa', id: 'lead-1' },
    listing: {
      id: 'list-1',
      externalId: 'ext-123',
      title: 'Casa 2 amb',
      price: 100000,
      currency: 'USD',
    },
  };

  it('reemplaza buyer.email y lead.message', () => {
    const t = '{"email":"{{buyer.email}}","msg":"{{lead.message}}"}';
    const out = renderPayloadTemplate(t, context);
    expect(out).toEqual({ email: 'user@test.com', msg: 'Hola, me interesa' });
  });

  it('reemplaza listing.externalId, title, price, currency', () => {
    const t =
      '{"listing_id":"{{listing.externalId}}","title":"{{listing.title}}","price":{{listing.price}},"currency":"{{listing.currency}}"}';
    const out = renderPayloadTemplate(t, context);
    expect(out).toEqual({
      listing_id: 'ext-123',
      title: 'Casa 2 amb',
      price: 100000,
      currency: 'USD',
    });
  });

  it('campos faltantes devuelven string vacío', () => {
    const t = '{"missing":"{{listing.url}}","id":"{{lead.id}}"}';
    const out = renderPayloadTemplate(t, context);
    expect(out.missing).toBe('');
    expect(out.id).toBe('lead-1');
  });

  it('template inválido (no JSON) devuelve {}', () => {
    const out = renderPayloadTemplate('not json at all', context);
    expect(out).toEqual({});
  });
});
