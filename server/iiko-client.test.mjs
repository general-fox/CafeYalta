import test from 'node:test';
import assert from 'node:assert/strict';
import { createIikoClient, IikoError } from './iiko-client.mjs';

const auth = { appId: 'test-app', clientSecret: 'never-expose-client-secret', apiKey: 'never-expose-api-key' };
const organizationId = '11111111-2222-3333-4444-555555555555';
const priceCategoryId = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
const correlationId = '12345678-abcd-1234-abcd-123456789abc';
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const deferred = () => {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
};
const pathOf = url => new URL(url).pathname;

test('missing credentials fail before any network call', async () => {
  for (const key of ['appId', 'clientSecret', 'apiKey']) {
    let calls = 0;
    const client = createIikoClient({ ...auth, [key]: '  ', fetchImpl: async () => { calls += 1; return json({}); } });
    await assert.rejects(client.organizations(), error => error instanceof IikoError && error.code === 'IIKO_CONFIG' && error.status === 503);
    assert.equal(calls, 0);
  }
});

test('v2 authentication, fixed origin, redirect policy and cached bearer are used', async () => {
  const calls = [];
  const client = createIikoClient({ ...auth, fetchImpl: async (url, options) => {
    calls.push({ url, options });
    return pathOf(url) === '/api/v2/access_token' ? json({ token: 'private-token' }) : json({ organizations: [] });
  } });
  assert.deepEqual(await client.organizations(), { organizations: [] });
  await client.organizations();
  assert.equal(calls.length, 3);
  assert.equal(calls[0].url, 'https://api-ru.iiko.services/api/v2/access_token');
  assert.deepEqual(JSON.parse(calls[0].options.body), auth);
  assert.equal(calls[0].options.headers.Authorization, undefined);
  for (const { url, options } of calls) {
    assert.equal(new URL(url).origin, 'https://api-ru.iiko.services');
    assert.equal(options.method, 'POST');
    assert.equal(options.redirect, 'error');
    assert.equal(options.headers['Content-Type'], 'application/json');
    assert.ok(options.signal instanceof AbortSignal);
  }
  assert.equal(calls[1].options.headers.Authorization, 'Bearer private-token');
  assert.deepEqual(JSON.parse(calls[1].options.body), {});
});

test('simultaneous reads share one authentication request', async () => {
  const gate = deferred();
  let tokenCalls = 0;
  let reads = 0;
  const client = createIikoClient({ ...auth, fetchImpl: async url => {
    if (pathOf(url) === '/api/v2/access_token') { tokenCalls += 1; await gate.promise; return json({ token: 'shared' }); }
    reads += 1;
    return json({ ok: true });
  } });
  const pending = Promise.all([client.organizations(), client.externalMenus(), client.terminalGroups(organizationId)]);
  assert.equal(tokenCalls, 1);
  assert.equal(reads, 0);
  gate.resolve();
  await pending;
  assert.equal(tokenCalls, 1);
  assert.equal(reads, 3);
});

test('token is renewed at the 55 minute cache boundary', async () => {
  let time = 1000;
  let tokenCalls = 0;
  const client = createIikoClient({ ...auth, now: () => time, fetchImpl: async url => {
    if (pathOf(url) === '/api/v2/access_token') return json({ token: `token-${++tokenCalls}` });
    return json({});
  } });
  await client.organizations();
  time += 55 * 60 * 1000 - 1;
  await client.organizations();
  assert.equal(tokenCalls, 1);
  time += 1;
  await client.organizations();
  assert.equal(tokenCalls, 2);
});

test('a 401 renews the token and retries a read exactly once', async () => {
  let tokenCalls = 0;
  const bearers = [];
  const client = createIikoClient({ ...auth, fetchImpl: async (url, options) => {
    if (pathOf(url) === '/api/v2/access_token') return json({ token: `token-${++tokenCalls}` });
    bearers.push(options.headers.Authorization);
    return bearers.length === 1 ? json({ errorDescription: 'private-token' }, 401) : json({ success: true });
  } });
  assert.deepEqual(await client.organizations(), { success: true });
  assert.deepEqual(bearers, ['Bearer token-1', 'Bearer token-2']);
  assert.equal(tokenCalls, 2);
});

test('a second 401 fails without an infinite retry', async () => {
  let tokenCalls = 0;
  let reads = 0;
  const client = createIikoClient({ ...auth, fetchImpl: async url => {
    if (pathOf(url) === '/api/v2/access_token') return json({ token: `token-${++tokenCalls}` });
    reads += 1;
    return json({ correlationId, message: auth.apiKey }, 401);
  } });
  await assert.rejects(client.organizations(), error => error.code === 'IIKO_AUTH' && error.status === 401 && error.correlationId === correlationId);
  assert.equal(tokenCalls, 2);
  assert.equal(reads, 2);
});

test('a late 401 for an old token does not evict the refreshed token', async () => {
  const late = deferred();
  let tokenCalls = 0;
  let warmed = false;
  const client = createIikoClient({ ...auth, fetchImpl: async (url, options) => {
    if (pathOf(url) === '/api/v2/access_token') return json({ token: `token-${++tokenCalls}` });
    if (!warmed) { warmed = true; return json({}); }
    if (options.headers.Authorization === 'Bearer token-1') {
      if (pathOf(url) === '/api/1/organizations') await late.promise;
      return json({}, 401);
    }
    return json({ ok: true });
  } });
  await client.organizations();
  const slow = client.organizations();
  await client.externalMenus();
  late.resolve();
  assert.deepEqual(await slow, { ok: true });
  assert.equal(tokenCalls, 2);
});

test('external menu and terminal group requests match the API shapes', async () => {
  const calls = [];
  const client = createIikoClient({ ...auth, fetchImpl: async (url, options) => {
    if (pathOf(url) === '/api/v2/access_token') return json({ token: 'token' });
    calls.push({ path: pathOf(url), body: JSON.parse(options.body) });
    return json({ raw: ['unchanged'] });
  } });
  await client.externalMenus();
  await client.externalMenus(organizationId);
  await client.terminalGroups(organizationId);
  assert.deepEqual(await client.menuById({ externalMenuId: 12345, organizationId }), { raw: ['unchanged'] });
  await client.menuById({ externalMenuId: '67890', organizationId, priceCategoryId });
  assert.deepEqual(calls, [
    { path: '/api/2/menu', body: {} },
    { path: '/api/2/menu', body: { organizationIds: [organizationId] } },
    { path: '/api/1/terminal_groups', body: { organizationIds: [organizationId], includeDisabled: false } },
    { path: '/api/menu/v3/by_id', body: { externalMenuId: 12345, organizationId } },
    { path: '/api/menu/v3/by_id', body: { externalMenuId: '67890', organizationId, priceCategoryId } },
  ]);
  assert.deepEqual(Object.keys(client).sort(), ['externalMenus', 'menuById', 'organizations', 'terminalGroups']);
});

test('HTTP errors never expose response bodies or unsafe correlation identifiers', async () => {
  for (const unsafeId of [auth.apiKey, 'https://example.test/private', { token: 'private-token' }, null]) {
    const client = createIikoClient({ ...auth, fetchImpl: async url => pathOf(url) === '/api/v2/access_token'
      ? json({ token: 'private-token' })
      : json({ correlationId: unsafeId, errorDescription: auth.clientSecret, message: auth.apiKey, token: 'private-token' }, 500) });
    await assert.rejects(client.organizations(), error => {
      assert.equal(error.code, 'IIKO_REQUEST');
      assert.equal(error.status, 500);
      assert.equal(error.correlationId, undefined);
      for (const secret of [auth.clientSecret, auth.apiKey, 'private-token']) {
        assert.ok(!`${error.stack} ${JSON.stringify(error)}`.includes(secret));
      }
      assert.equal(error.cause, undefined);
      return true;
    });
  }
});

test('network and malformed JSON errors are sanitized', async () => {
  const network = createIikoClient({ ...auth, fetchImpl: async () => { throw new Error(`Network error with ${auth.apiKey}`); } });
  await assert.rejects(network.organizations(), error => error.code === 'IIKO_NETWORK' && !error.message.includes(auth.apiKey));
  const malformed = createIikoClient({ ...auth, fetchImpl: async () => new Response(`secret=${auth.clientSecret}`, { status: 200 }) });
  await assert.rejects(malformed.organizations(), error => error.code === 'IIKO_RESPONSE' && !error.message.includes(auth.clientSecret));
});

test('successful authentication and business responses must be JSON objects', async () => {
  for (const invalid of [null, auth.clientSecret, [auth.apiKey], 42, true]) {
    for (const invalidAuth of [false, true]) {
      const client = createIikoClient({ ...auth, fetchImpl: async url => {
        if (pathOf(url) === '/api/v2/access_token' && !invalidAuth) return json({ token: 'private-token' });
        return json(invalid);
      } });
      await assert.rejects(client.menuById({ externalMenuId: 123, organizationId }), error => {
        assert.equal(error.code, 'IIKO_RESPONSE');
        assert.equal(error.status, 502);
        assert.equal(error.correlationId, undefined);
        for (const secret of [auth.clientSecret, auth.apiKey, 'private-token']) {
          assert.ok(!`${error.stack} ${JSON.stringify(error)}`.includes(secret));
        }
        return true;
      });
    }
  }
});

test('timeouts abort and reject at 15 seconds even when fetch ignores abort', async context => {
  context.mock.timers.enable({ apis: ['setTimeout'] });
  let signal;
  const client = createIikoClient({ ...auth, fetchImpl: async (_url, options) => {
    signal = options.signal;
    return new Promise(() => {});
  } });
  const pending = assert.rejects(client.organizations(), error => error.code === 'IIKO_TIMEOUT' && error.status === 504);
  context.mock.timers.tick(14_999);
  assert.equal(signal.aborted, false);
  context.mock.timers.tick(1);
  await pending;
  assert.equal(signal.aborted, true);
});

test('a failed authentication request releases the single-flight slot', async () => {
  let tokenCalls = 0;
  const client = createIikoClient({ ...auth, fetchImpl: async url => {
    if (pathOf(url) === '/api/v2/access_token') {
      tokenCalls += 1;
      return tokenCalls === 1 ? json({ error: auth.apiKey }, 500) : json({ token: 'recovered' });
    }
    return json({ ok: true });
  } });
  await assert.rejects(client.organizations(), { code: 'IIKO_REQUEST' });
  assert.deepEqual(await client.organizations(), { ok: true });
  assert.equal(tokenCalls, 2);
});
