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

async function serve(t, { config = configured(), client, now, orderService, store, onRequest } = {}) {
  const server = createApiServer({ config, client: client || { menuById() { throw new Error('Unexpected upstream call'); } }, now, orderService, store });
  if (onRequest) server.on('request', onRequest);
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
  const allowed = await request('/api/health', { headers: { origin: 'http://localhost:5180', 'sec-fetch-site': 'cross-site' } });
  assert.equal(allowed.status, 200);
  assert.equal(allowed.headers.get('access-control-allow-origin'), 'http://localhost:5180');
  await allowed.text();
});

test('write methods cannot create orders or trigger upstream calls', async t => {
  const request = await serve(t);
  const response = await request('/api/orders', { method: 'POST', body: '{}' });
  assert.equal(response.status, 405);
  assert.equal((await response.json()).error, 'READ_ONLY');
});

test('menu reads share a 15-second cache and preserve sizes/modifiers instead of dropping them', async t => {
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
  timestamp += 14_999;
  const stillCached = await request('/api/menu');
  assert.deepEqual(await stillCached.json(), first);
  assert.equal(calls, 1);
  timestamp += 1;
  const refreshed = await request('/api/menu');
  assert.notEqual((await refreshed.json()).fetchedAt, first.fetchedAt);
  assert.equal(calls, 2);
});

const saladId = '11111111-2222-4333-8444-555555555555';
const waterId = '22222222-2222-4333-8444-555555555555';
const pizzaId = '33333333-2222-4333-8444-555555555555';
const menuItem = (productId, name, price, image = '') => ({ productId, name, sizePrices: [{ price, buttonImageUrl: image }] });
const menuSnapshot = items => ({ itemsGroups: [{ id: 'menu-group', name: 'Меню', items }] });
const oldMenu = () => menuSnapshot([
  menuItem(saladId, 'Салат', 100, 'https://images.example.test/salad-before.jpg'),
  menuItem(waterId, 'Вода', 50),
]);
const newMenu = () => menuSnapshot([
  menuItem(saladId, 'Салат', 125, 'https://images.example.test/salad-after.jpg'),
  menuItem(pizzaId, 'Пицца', 350),
]);
function deferred() {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
}

test('an ordinary menu read after TTL updates photos, prices and the available catalogue; refresh=1 also bypasses a valid cache', async t => {
  let timestamp = 1_000;
  let calls = 0;
  let upstream = oldMenu();
  const request = await serve(t, { now: () => timestamp, client: { async menuById() { calls++; return upstream; } } });
  const first = await (await request('/api/menu')).json();
  assert.deepEqual(first.products.map(product => product.name), ['Салат', 'Вода']);

  upstream = newMenu();
  timestamp += 15_000;
  const updatedResponse = await request('/api/menu');
  assert.equal(updatedResponse.status, 200);
  const updated = await updatedResponse.json();
  assert.deepEqual(updated.products.map(product => product.name), ['Салат', 'Пицца']);
  assert.equal(updated.products[0].price, 125);
  assert.equal(updated.products[0].image, 'https://images.example.test/salad-after.jpg');
  assert.equal(updated.fetchedAt, new Date(timestamp).toISOString());
  assert.equal(calls, 2);

  upstream = menuSnapshot([menuItem(saladId, 'Салат', 130, 'https://images.example.test/salad-forced.jpg')]);
  timestamp += 100;
  const forcedResponse = await request('/api/menu?refresh=1');
  assert.equal(forcedResponse.status, 200);
  const forced = await forcedResponse.json();
  assert.equal(forced.products.length, 1);
  assert.equal(forced.products[0].price, 130);
  assert.equal(forced.products[0].image, 'https://images.example.test/salad-forced.jpg');
  assert.equal(calls, 3);
});

test('concurrent menu requests after TTL share one upstream read until it completes', async t => {
  let timestamp = 1_000;
  let calls = 0;
  let arrivals = 0;
  const gate = deferred();
  const allArrived = deferred();
  const request = await serve(t, {
    now: () => timestamp,
    client: { async menuById() { calls++; return calls === 1 ? oldMenu() : gate.promise; } },
    onRequest(incoming) { if (incoming.url === '/api/menu' && ++arrivals === 4) allArrived.resolve(); },
  });
  await (await request('/api/menu')).json();
  timestamp += 15_000;
  const pending = Promise.all([request('/api/menu'), request('/api/menu'), request('/api/menu')]);
  // All three HTTP handlers have entered while the upstream response is held.
  await allArrived.promise;
  const callsWhilePending = calls;
  gate.resolve(newMenu());
  const responses = await pending;
  const results = await Promise.all(responses.map(async response => { assert.equal(response.status, 200); return response.json(); }));
  assert.equal(callsWhilePending, 2);
  assert.equal(calls, 2);
  assert.deepEqual(results[0], results[1]);
  assert.deepEqual(results[1], results[2]);
  assert.equal(results[0].products[0].image, 'https://images.example.test/salad-after.jpg');
});

test('an upstream outage after TTL never returns a successful stale menu and the next read can recover', async t => {
  let timestamp = 1_000;
  let calls = 0;
  let unavailable = false;
  const request = await serve(t, {
    now: () => timestamp,
    client: { async menuById() {
      calls++;
      if (unavailable) throw new Error('private upstream failure');
      return calls === 1 ? oldMenu() : newMenu();
    } },
  });
  assert.equal((await request('/api/menu')).status, 200);
  timestamp += 15_000;
  unavailable = true;
  const failedResponse = await request('/api/menu');
  assert.equal(failedResponse.status, 502);
  const failure = await failedResponse.json();
  assert.equal(failure.error, 'IIKO_UNAVAILABLE');
  assert.equal(failure.products, undefined);
  assert.equal(failure.data, undefined);
  assert.equal(failure.fetchedAt, undefined);
  assert.doesNotMatch(JSON.stringify(failure), /private upstream|salad-before/);
  unavailable = false;
  const recoveredResponse = await request('/api/menu');
  assert.equal(recoveredResponse.status, 200);
  const recovered = await recoveredResponse.json();
  assert.equal(recovered.products[0].price, 125);
  assert.equal(recovered.products[0].image, 'https://images.example.test/salad-after.jpg');
  assert.equal(calls, 3);
});

test('unexpected errors never expose upstream text or credentials', async t => {
  const request = await serve(t, { client: { async menuById() { throw new Error('do-not-expose-secret: token=private'); } } });
  const response = await request('/api/menu');
  assert.equal(response.status, 502);
  const text = await response.text();
  assert.doesNotMatch(text, /do-not-expose|private/);
  assert.equal(JSON.parse(text).error, 'IIKO_UNAVAILABLE');
});

test('configuration retains all menu IDs as strings for menu v3', () => {
  assert.equal(readConfig({ IIKO_EXTERNAL_MENU_ID: '123' }).selection.externalMenuId, '123');
  assert.equal(readConfig({ IIKO_EXTERNAL_MENU_ID: ' 00123 ' }).selection.externalMenuId, '00123');
  assert.equal(readConfig({ IIKO_EXTERNAL_MENU_ID: 'menu-abc' }).selection.externalMenuId, 'menu-abc');
  assert.equal(readConfig({ IIKO_EXTERNAL_MENU_ID: '9007199254740993' }).selection.externalMenuId, '9007199254740993');
  assert.throws(() => readConfig({ API_PORT: '0' }));
  assert.throws(() => readConfig({ API_PORT: 'https://example.com' }));
});

const requestId = 'ab52f062-d7b3-4646-956b-050324b71c8a';
const token = '59a10a3a-055d-4931-8d43-2501913d44f5';
const orderConfig = () => readConfig({
  IIKO_APP_ID: 'test-app', IIKO_CLIENT_SECRET: 'do-not-expose-secret', IIKO_API_KEY: 'do-not-expose-key',
  IIKO_ORGANIZATION_ID: 'test-org', IIKO_EXTERNAL_MENU_ID: '123',
  IIKO_TERMINAL_GROUP_ID: 'test-terminal', IIKO_ORDERING_ENABLED: 'true',
});
const orderHeaders = () => ({ origin: 'http://localhost:5180', 'content-type': 'application/json', authorization: `Bearer ${token}` });

test('menu includes verified order methods and address format from the ordering service', async t => {
  const ordering = { methods: ['pickup', 'delivery'], payment: 'cash_on_receipt', deliveryFee: 0, addressFormat: 'legacy' };
  const request = await serve(t, {
    config: orderConfig(), client: { async menuById() { return oldMenu(); } },
    orderService: { async capabilities() { return ordering; } },
  });
  const response = await request('/api/menu');
  assert.equal(response.status, 200);
  assert.deepEqual((await response.json()).ordering, ordering);
});

test('ordering needs an explicit flag and a selected terminal group', () => {
  assert.equal(configured().orderingEnabled, false);
  assert.equal(readConfig({ IIKO_ORDERING_ENABLED: 'true' }).orderingEnabled, false);
  assert.equal(orderConfig().orderingEnabled, true);
  assert.equal(orderConfig().selection.terminalGroupId, 'test-terminal');
});

test('local checkout forwards a capability-protected request and returns processing', async t => {
  let received;
  const payload = { requestId, method: 'pickup', items: [{ id: 'food', quantity: 1 }] };
  const request = await serve(t, { config: orderConfig(), orderService: {
    async create(body, access) { received = { body, access }; return { id: requestId, status: 'processing', total: 100 }; },
  } });
  const response = await request('/api/orders', { method: 'POST', headers: orderHeaders(), body: JSON.stringify(payload) });
  assert.equal(response.status, 202);
  assert.equal((await response.json()).status, 'processing');
  assert.deepEqual(received, { body: payload, access: token });
});

test('checkout blocks cross-site, missing capability, invalid JSON and oversized bodies before creating', async t => {
  let calls = 0;
  const request = await serve(t, { config: orderConfig(), orderService: { async create() { calls++; } } });
  for (const [headers, body, expected] of [
    [{ ...orderHeaders(), origin: 'https://evil.example' }, '{}', 403],
    [{ 'content-type': 'application/json', authorization: `Bearer ${token}` }, '{}', 403],
    [{ origin: 'http://localhost:5180', 'content-type': 'application/json' }, '{}', 401],
    [{ ...orderHeaders(), 'content-type': 'text/plain' }, '{}', 415],
    [orderHeaders(), '{broken', 400],
    [orderHeaders(), JSON.stringify({ comment: 'x'.repeat(17000) }), 413],
  ]) {
    const response = await request('/api/orders', { method: 'POST', headers, body });
    assert.equal(response.status, expected);
    await response.text();
  }
  assert.equal(calls, 0);
});

test('order status forwards its capability and never allows an unprotected lookup', async t => {
  let calls = 0;
  const request = await serve(t, { config: orderConfig(), orderService: { async get(id, access) {
    calls++; assert.equal(id, requestId); assert.equal(access, token); return { id, status: 'accepted', total: 100 };
  } } });
  const denied = await request(`/api/orders/${requestId}`);
  assert.equal(denied.status, 404);
  await denied.text();
  assert.equal(calls, 0);
  const allowed = await request(`/api/orders/${requestId}`, { headers: { authorization: `Bearer ${token}` } });
  assert.equal(allowed.status, 200);
  assert.equal((await allowed.json()).status, 'accepted');
  assert.equal(calls, 1);
});

test('checkout errors never expose an upstream response or stored order data', async t => {
  const request = await serve(t, { config: orderConfig(), orderService: { async create() { throw new Error('do-not-expose-secret / private-token'); } } });
  const response = await request('/api/orders', { method: 'POST', headers: orderHeaders(), body: '{}' });
  assert.equal(response.status, 502);
  const text = await response.text();
  assert.doesNotMatch(text, /do-not-expose|private-token/);
  assert.equal(JSON.parse(text).error, 'ORDER_STATE_UNKNOWN');
});
