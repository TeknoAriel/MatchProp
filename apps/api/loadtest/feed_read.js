/**
 * k6 load test: feed read-only
 * Simula scroll: GET /feed, si hay nextCursor hace otra llamada
 *
 * Env: BASE_URL, EMAIL, PASSWORD, LIMIT
 * Ejemplo: k6 run --env BASE_URL=http://localhost:3001 loadtest/feed_read.js
 */

import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3001';
const EMAIL = __ENV.EMAIL || 'demo@matchprop.com';
const PASSWORD = __ENV.PASSWORD || 'demo';
const LIMIT = __ENV.LIMIT || '20';

export const options = {
  stages: [
    { duration: '30s', target: 25 },
    { duration: '1m', target: 100 },
    { duration: '2m', target: 100 },
    { duration: '30s', target: 0 },
  ],
  thresholds: {
    http_req_failed: ['rate<0.01'],
    'http_req_duration{endpoint:feed}': ['p(95)<800'],
    http_req_duration: ['p(95)<1000'],
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

function validFeed(res) {
  check(res, { 'status 200': (r) => r.status === 200 });
  if (res.status !== 200) return null;

  const body = res.json();
  check(body, {
    'feed has items[]': (b) => Array.isArray(b.items),
    'feed total is number': (b) => b.total == null || Number.isFinite(b.total),
    'feed limit is number': (b) => b.limit == null || Number.isFinite(b.limit),
  });
  return body;
}

export default function (data) {
  const url1 = `${BASE_URL}/feed?limit=${LIMIT}`;
  const res1 = http.get(url1, {
    headers: { Authorization: `Bearer ${data.token}` },
    tags: { endpoint: 'feed' },
  });
  const body1 = validFeed(res1);
  if (!body1) return;

  const next = body1.nextCursor;
  if (typeof next === 'string' && next.length > 0) {
    const url2 = `${BASE_URL}/feed?limit=${LIMIT}&cursor=${encodeURIComponent(next)}`;
    const res2 = http.get(url2, {
      headers: { Authorization: `Bearer ${data.token}` },
      tags: { endpoint: 'feed' },
    });
    validFeed(res2);
  }

  sleep(0.2);
}
