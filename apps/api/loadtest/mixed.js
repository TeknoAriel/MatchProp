/**
 * k6 load test: mix realista
 * 70% GET /feed, 20% POST /swipes, 10% PUT /preferences
 *
 * Env: BASE_URL, EMAIL, PASSWORD, LIMIT
 */

import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3001';
const EMAIL = __ENV.EMAIL || 'demo@matchprop.com';
const PASSWORD = __ENV.PASSWORD || 'demo';
const LIMIT = __ENV.LIMIT || '20';

const OPERATIONS = ['SALE', 'RENT'];
const PROPERTY_TYPES = ['HOUSE', 'APARTMENT', 'LAND', 'OFFICE', 'OTHER'];

export const options = {
  stages: [
    { duration: '30s', target: 25 },
    { duration: '1m', target: 100 },
    { duration: '2m', target: 100 },
    { duration: '30s', target: 0 },
  ],
  thresholds: {
    http_req_failed: ['rate<0.02'],
    'http_req_duration{endpoint:feed}': ['p(95)<1200'],
    'http_req_duration{endpoint:swipes}': ['p(95)<1200'],
    'http_req_duration{endpoint:preferences}': ['p(95)<1200'],
    http_req_duration: ['p(95)<1200'],
  },
};

export function setup() {
  const res = http.post(
    `${BASE_URL}/auth/login`,
    JSON.stringify({ email: EMAIL, password: PASSWORD }),
    {
      headers: { 'Content-Type': 'application/json' },
    }
  );
  if (res.status !== 200) {
    throw new Error(`Login failed: ${res.status} ${res.body}`);
  }
  const body = JSON.parse(res.body);
  return { token: body.token };
}

export default function (data) {
  const token = data.token;
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  const r = Math.random();

  if (r < 0.7) {
    const res = http.get(`${BASE_URL}/feed?limit=${LIMIT}`, {
      headers,
      tags: { endpoint: 'feed' },
    });
    check(res, { 'feed 2xx': (r) => r.status >= 200 && r.status < 300 });
  } else if (r < 0.9) {
    const feedRes = http.get(`${BASE_URL}/feed?limit=5`, { headers });
    let propertyId = null;
    if (feedRes.status === 200) {
      try {
        const b = JSON.parse(feedRes.body);
        if (b.items && b.items.length > 0) {
          propertyId = b.items[0].id;
        }
      } catch (_) {}
    }
    if (propertyId) {
      const swipeRes = http.post(
        `${BASE_URL}/swipes`,
        JSON.stringify({ propertyId, direction: 'DISLIKE' }),
        { headers, tags: { endpoint: 'swipes' } }
      );
      check(swipeRes, { 'swipe 2xx': (r) => r.status >= 200 && r.status < 300 });
    }
  } else {
    const op = OPERATIONS[Math.floor(Math.random() * OPERATIONS.length)];
    const pt = PROPERTY_TYPES[Math.floor(Math.random() * PROPERTY_TYPES.length)];
    const minP = Math.floor(Math.random() * 100000) + 20000;
    const maxP = Math.floor(Math.random() * 300000) + 100000;
    const payload = {
      operation: op,
      propertyTypes: [pt],
      minPrice: Math.min(minP, maxP),
      maxPrice: Math.max(minP, maxP),
    };
    const res = http.put(`${BASE_URL}/preferences`, JSON.stringify(payload), {
      headers,
      tags: { endpoint: 'preferences' },
    });
    check(res, { 'preferences 2xx': (r) => r.status >= 200 && r.status < 300 });
  }

  sleep(0.3);
}
