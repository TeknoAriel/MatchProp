/**
 * k6 load test: big data multi-token (feed + swipes + preferences)
 * ~70% GET /feed, ~29% POST /swipes, ~1% PUT /preferences
 * Rota tokens de varios users para simular tráfico real sin quedarse sin feed.
 *
 * Env: BASE_URL, USERS_COUNT, USER_PREFIX, PASSWORD, LIMIT, CONTROL_EMAIL
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter } from 'k6/metrics';
import { textSummary } from 'https://jslib.k6.io/k6-summary/0.0.2/index.js';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3001';
const USERS_COUNT = parseInt(__ENV.USERS_COUNT || '50', 10);
const USER_PREFIX = __ENV.USER_PREFIX || 'loaduser';
const PASSWORD = __ENV.PASSWORD || 'demo';
const LIMIT = __ENV.LIMIT || '20';
const CONTROL_EMAIL = __ENV.CONTROL_EMAIL || 'load@matchprop.com';

const OPERATIONS = ['SALE', 'RENT'];
const PROPERTY_TYPES = ['HOUSE', 'APARTMENT', 'LAND', 'OFFICE', 'OTHER'];

// Contadores por status y endpoint para diagnóstico
const statusCounter = new Counter('http_status_by_endpoint');

function pad3(n) {
  return String(n).padStart(3, '0');
}

function recordStatus(endpoint, res) {
  const status =
    res.status === 0 || (res.error && res.error.includes('timeout'))
      ? 'timeout'
      : String(res.status);
  statusCounter.add(1, { endpoint, status });
}

export const options = {
  stages: [
    { duration: '30s', target: 50 },
    { duration: '2m', target: 200 },
    { duration: '5m', target: 200 },
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
  const tokens = [];
  const login = (email) => {
    const res = http.post(`${BASE_URL}/auth/login`, JSON.stringify({ email, password: PASSWORD }), {
      headers: { 'Content-Type': 'application/json' },
    });
    if (res.status !== 200) {
      throw new Error(`Login failed for ${email}: ${res.status} ${res.body}`);
    }
    const body = JSON.parse(res.body);
    return body.token;
  };
  tokens.push(login(CONTROL_EMAIL));
  for (let i = 1; i <= USERS_COUNT; i++) {
    tokens.push(login(`${USER_PREFIX}+${pad3(i)}@matchprop.com`));
  }
  return { tokens };
}

function validFeed(res) {
  check(res, { 'feed status 200': (r) => r.status === 200 });
  if (res.status !== 200) return null;
  const body = res.json();
  check(body, { 'feed has items[]': (b) => Array.isArray(b.items) });
  check(body, { 'feed limit number': (b) => typeof b.limit === 'number' });
  check(body, {
    'feed total number or null': (b) => b.total === null || typeof b.total === 'number',
  });
  return body;
}

export default function (data) {
  const token = data.tokens[(__VU - 1) % data.tokens.length];
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  const r = Math.random();

  // ~69% feed, ~30% swipes, ~1% preferences
  if (r < 0.69) {
    const url1 = `${BASE_URL}/feed?limit=${LIMIT}`;
    const res1 = http.get(url1, { headers, tags: { endpoint: 'feed' } });
    recordStatus('feed', res1);
    const body1 = validFeed(res1);
    if (body1) {
      const next = body1.nextCursor;
      if (typeof next === 'string' && next.length > 0) {
        const url2 = `${BASE_URL}/feed?limit=${LIMIT}&cursor=${encodeURIComponent(next)}`;
        const res2 = http.get(url2, { headers, tags: { endpoint: 'feed' } });
        recordStatus('feed', res2);
        validFeed(res2);
      }
    }
  } else if (r < 0.99) {
    const feedRes = http.get(`${BASE_URL}/feed?limit=5`, { headers, tags: { endpoint: 'feed' } });
    recordStatus('feed', feedRes);
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
      recordStatus('swipes', swipeRes);
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
    recordStatus('preferences', res);
    check(res, { 'preferences status 200': (r) => r.status === 200 });
  }

  sleep(0.2);
}

export function handleSummary(data) {
  const lines = ['\n=== STATUS BREAKDOWN BY ENDPOINT ==='];
  const metrics = data.metrics || {};
  const byEndpoint = {};
  for (const [metricKey, metric] of Object.entries(metrics)) {
    if (!metricKey.startsWith('http_status_by_endpoint')) continue;
    const count = metric.values?.count ?? metric.values?.value ?? 0;
    const match =
      metricKey.match(/\{endpoint:(\w+),status:(\w+)\}/) ||
      metricKey.match(/\{status:(\w+),endpoint:(\w+)\}/) ||
      metricKey.match(/endpoint[=:](\w+).*status[=:](\w+)/) ||
      metricKey.match(/status[=:](\w+).*endpoint[=:](\w+)/);
    if (match) {
      const ep = match[1];
      const st = match[2];
      if (!byEndpoint[ep]) byEndpoint[ep] = {};
      byEndpoint[ep][st] = (byEndpoint[ep][st] || 0) + count;
    }
  }
  for (const [ep, counts] of Object.entries(byEndpoint).sort()) {
    lines.push(`\n${ep}:`);
    for (const [st, n] of Object.entries(counts).sort((a, b) => b[1] - a[1])) {
      lines.push(`  ${st}: ${n}`);
    }
  }
  lines.push('\n==============================\n');
  const statusBreakdown = lines.join('\n');
  const defaultSummary = textSummary(data, { indent: ' ', enableColors: true });
  return {
    stdout: defaultSummary + statusBreakdown,
    'summary-status.json': JSON.stringify(data, null, 2),
  };
}
