import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { request as httpRequest } from 'node:http';
import { readConfig } from './config.mjs';
import { createApiServer } from './app.mjs';

const configured = () => readConfig({
  IIKO_APP_ID: 'test-app', IIKO_CLIENT_SECRET: 'do-not-expose-secret', IIKO_API_KEY: 'do-not-expose-key',
  IIKO_ORGANIZATION_ID: 'test-org', IIKO_EXTERNAL_MENU_ID: '123',
});

async function serve(t, { config = configured(), client, now } = {}) {
  const server = createApiServer({ config, client: client || { menuById() { throw new Error('Unexpected upstream call'); } }, now });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }));
  // Use HTTP directly: fetch normalizes Host, which these boundary tests vary.
  return (path, options = {}) => new Promise((resolve, reject) => {
    const request = httpRequest({
      hostname: '127.0.0.1', port: server.address().port, path,
      method: options.method || 'GET',
      headers: { host: `127.0.0.1:${config.port}`, ...options.headers },
    }, response => {
      const chunks = [];
      response.on('data', chunk => chunks.push(chunk));
      response.on('error', reject);
      response.on('end', () => resolve(new Response(response.statusCode === 204 ? null : Buffer.concat(chunks), {
        status: response.statusCode, headers: response.headers,
      })));
    });
    request.on('error', reject);
    request.end(options.body);
  });
}

test('health reports configuration separately from connectivity, without credentials', async t => {
  const request = await serve(t);
  const response = await request('/api/health');
  assert.equal(response.status, 200);
  const text = await response.text();
  const data = JSON.parse(text);
  assert.equal(data.credentialsConfigured, true);
  assert.equal(data.orderingEnabled, false);
  assert.match(data.message, /npm run iiko:check/);
  assert.doesNotMatch(text, /do-not-expose|test-app/);
});

test('missing settings return helpful names and never call iiko', async t => {
  const request = await serve(t, { config: readConfig({}) });
  const response = await request('/api/menu');
  assert.equal(response.status, 503);
  const data = await response.json();
  assert.equal(data.error, 'IIKO_NOT_CONFIGURED');
  assert.ok(data.missing.includes('IIKO_API_KEY'));
  assert.ok(data.missing.includes('IIKO_EXTERNAL_MENU_ID'));
});

test('local API blocks rebinding, unknown origins and cross-site requests', async t => {
  const request = await serve(t);
  for (const headers of [
    { host: 'evil.example:3001' },
    { origin: 'https://evil.example' },
    { 'sec-fetch-site': 'cross-site' },
  ]) {
    const response = await request('/api/health', { headers });
    assert.equal(response.status, 403);
    await response.text();
  }
  const allowed = await request('/api/health', { headers: { origin: 'http://localhost:5173', 'sec-fetch-site': 'cross-site' } });
  assert.equal(allowed.status, 200);
  assert.equal(allowed.headers.get('access-control-allow-origin'), 'http://localhost:5173');
  await allowed.text();
});

test('write methods cannot create orders or trigger upstream calls', async t => {
  const request = await serve(t);
  const response = await request('/api/orders', { method: 'POST', body: '{}' });
  assert.equal(response.status, 405);
  assert.equal((await response.json()).error, 'READ_ONLY');
});

test('menu reads share a cache and preserve sizes/modifiers instead of dropping them', async t => {
  let timestamp = 1_000;
  let calls = 0;
  const selection = configured().selection;
  const raw = { itemsGroups: [{ items: [{ productId: 'food', sizePrices: [{ sizeId: 'large' }], modifierGroups: [{ minAmount: 1 }] }] }] };
  const request = await serve(t, {
    now: () => timestamp,
    client: { async menuById(received) { calls++; assert.deepEqual(received, selection); return raw; } },
  });
  const [a, b] = await Promise.all([request('/api/menu'), request('/api/menu')]);
  const [first, second] = await Promise.all([a.json(), b.json()]);
  assert.equal(calls, 1);
  assert.deepEqual(first.data, raw);
  assert.deepEqual(first, second);
  assert.equal(first.orderingEnabled, false);
  timestamp += 300_001;
  const refreshed = await request('/api/menu');
  await refreshed.json();
  assert.equal(calls, 2);
});

test('unexpected errors never expose upstream text or credentials', async t => {
  const request = await serve(t, { client: { async menuById() { throw new Error('do-not-expose-secret: token=private'); } } });
  const response = await request('/api/menu');
  assert.equal(response.status, 502);
  const text = await response.text();
  assert.doesNotMatch(text, /do-not-expose|private/);
  assert.equal(JSON.parse(text).error, 'IIKO_UNAVAILABLE');
});

test('configuration retains opaque menu IDs and parses safe numeric IDs', () => {
  assert.equal(readConfig({ IIKO_EXTERNAL_MENU_ID: '123' }).selection.externalMenuId, 123);
  assert.equal(readConfig({ IIKO_EXTERNAL_MENU_ID: 'menu-abc' }).selection.externalMenuId, 'menu-abc');
  assert.equal(readConfig({ IIKO_EXTERNAL_MENU_ID: '9007199254740993' }).selection.externalMenuId, '9007199254740993');
  assert.throws(() => readConfig({ API_PORT: '0' }));
  assert.throws(() => readConfig({ API_PORT: 'https://example.com' }));
});
