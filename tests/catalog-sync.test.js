import test from 'node:test';
import assert from 'node:assert/strict';
import { CATALOG_SYNC_INTERVAL_MS, sameCatalogContent, startCatalogSync } from '../src/catalog-sync.js';

class EventTargetFake {
  listeners = new Map();
  addEventListener(type, listener) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type).add(listener);
  }
  removeEventListener(type, listener) { this.listeners.get(type)?.delete(listener); }
  dispatch(type) { for (const listener of [...(this.listeners.get(type) || [])]) listener({ type }); }
  get listenerCount() { return [...this.listeners.values()].reduce((count, listeners) => count + listeners.size, 0); }
}

function timersFake() {
  let now = 0;
  let identifier = 0;
  const timers = new Map();
  return {
    setTimeoutFn(callback, delay) { const id = ++identifier; timers.set(id, { callback, at: now + delay }); return id; },
    clearTimeoutFn(id) { timers.delete(id); },
    tick(duration) {
      const end = now + duration;
      while (true) {
        const next = [...timers].filter(([, timer]) => timer.at <= end).sort((a, b) => a[1].at - b[1].at || a[0] - b[0])[0];
        if (!next) break;
        const [id, timer] = next;
        now = timer.at;
        timers.delete(id);
        timer.callback();
      }
      now = end;
    },
    get pending() { return timers.size; },
  };
}

function fixture({ visible = true, online = true } = {}) {
  const document = Object.assign(new EventTargetFake(), { visibilityState: visible ? 'visible' : 'hidden' });
  const window = Object.assign(new EventTargetFake(), { navigator: { onLine: online } });
  const timers = timersFake();
  return {
    document, window, timers,
    start(refresh, intervalMs) { return startCatalogSync({ refresh, document, window, intervalMs, setTimeoutFn: timers.setTimeoutFn, clearTimeoutFn: timers.clearTimeoutFn }); },
    visibility(value) { document.visibilityState = value ? 'visible' : 'hidden'; document.dispatch('visibilitychange'); },
    connection(value) { window.navigator.onLine = value; window.dispatch(value ? 'online' : 'offline'); },
  };
}

function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

async function flush() { for (let turn = 0; turn < 8; turn++) await Promise.resolve(); }

test('a visible online tab reads immediately and receives changed content on the next interval', async () => {
  assert.equal(CATALOG_SYNC_INTERVAL_MS, 15_000);
  const f = fixture();
  const received = [];
  let remotePrice = 100;
  const stop = f.start(async () => { received.push(remotePrice); });
  assert.deepEqual(received, [100]);
  await flush();
  remotePrice = 125;
  f.timers.tick(14_999);
  assert.deepEqual(received, [100]);
  f.timers.tick(1);
  await flush();
  assert.deepEqual(received, [100, 125]);
  assert.equal(f.timers.pending, 1);
  stop();
});

test('the interval starts after refresh settles and a slow refresh never overlaps another', async () => {
  const f = fixture();
  const request = deferred();
  let calls = 0;
  const stop = f.start(() => { calls++; return calls === 1 ? request.promise : Promise.resolve(); });
  f.timers.tick(60_000);
  assert.equal(calls, 1);
  assert.equal(f.timers.pending, 0);
  request.resolve();
  await flush();
  f.timers.tick(14_999);
  assert.equal(calls, 1);
  f.timers.tick(1);
  assert.equal(calls, 2);
  await flush();
  assert.equal(f.timers.pending, 1);
  stop();
});

test('hidden and offline tabs pause, then resume immediately on visibility, online and focus', async () => {
  const f = fixture();
  let calls = 0;
  const stop = f.start(async () => { calls++; });
  await flush();
  assert.equal(calls, 1);
  f.visibility(false);
  assert.equal(f.timers.pending, 0);
  f.window.dispatch('focus');
  f.timers.tick(90_000);
  assert.equal(calls, 1);
  f.visibility(true);
  assert.equal(calls, 2);
  await flush();
  f.connection(false);
  assert.equal(f.timers.pending, 0);
  f.window.dispatch('focus');
  f.timers.tick(90_000);
  assert.equal(calls, 2);
  f.connection(true);
  assert.equal(calls, 3);
  await flush();
  f.window.dispatch('focus');
  assert.equal(calls, 4);
  await flush();
  assert.equal(f.timers.pending, 1);
  stop();
});

test('initial hidden or offline state makes no request until it becomes eligible', async () => {
  for (const state of [{ visible: false }, { online: false }]) {
    const f = fixture(state);
    let calls = 0;
    const stop = f.start(async () => { calls++; });
    f.window.dispatch('focus');
    f.timers.tick(90_000);
    assert.equal(calls, 0);
    assert.equal(f.timers.pending, 0);
    if (state.visible === false) f.visibility(true);
    else f.connection(true);
    assert.equal(calls, 1);
    await flush();
    assert.equal(f.timers.pending, 1);
    stop();
  }
});

test('wake event storms coalesce into one queued read, with a maximum of one active request', async () => {
  const f = fixture();
  const requests = [];
  let active = 0;
  let maximum = 0;
  const stop = f.start(() => {
    const request = deferred();
    requests.push(request);
    maximum = Math.max(maximum, ++active);
    return request.promise.finally(() => { active--; });
  });
  for (let event = 0; event < 20; event++) {
    f.window.dispatch('focus');
    f.document.dispatch('visibilitychange');
    f.window.dispatch('online');
  }
  assert.equal(requests.length, 1);
  assert.equal(f.timers.pending, 0);
  requests[0].resolve();
  await flush();
  assert.equal(requests.length, 2);
  assert.equal(maximum, 1);
  requests[1].resolve();
  await flush();
  assert.equal(requests.length, 2);
  assert.equal(f.timers.pending, 1);
  stop();
});

test('going hidden or offline during a request drops queued wakes and creates no next timer', async () => {
  for (const suspend of ['hidden', 'offline']) {
    const f = fixture();
    const request = deferred();
    let calls = 0;
    const stop = f.start(() => { calls++; return request.promise; });
    f.window.dispatch('focus');
    if (suspend === 'hidden') f.visibility(false);
    else f.connection(false);
    request.resolve();
    await flush();
    assert.equal(calls, 1);
    assert.equal(f.timers.pending, 0);
    stop();
  }
});

test('synchronous and asynchronous read failures are swallowed and retry on the normal interval', async () => {
  const f = fixture();
  let calls = 0;
  const stop = f.start(() => {
    calls++;
    if (calls === 1) throw new Error('read failed');
    if (calls === 2) return Promise.reject(new Error('network failed'));
    return Promise.resolve();
  }, 100);
  await flush();
  assert.equal(f.timers.pending, 1);
  f.timers.tick(100);
  await flush();
  assert.equal(calls, 2);
  assert.equal(f.timers.pending, 1);
  f.timers.tick(100);
  await flush();
  assert.equal(calls, 3);
  stop();
});

test('cleanup removes listeners and timers, and late completion cannot restart the loop', async () => {
  const f = fixture();
  const request = deferred();
  let calls = 0;
  const stop = f.start(() => { calls++; return request.promise; });
  assert.equal(f.document.listenerCount, 1);
  assert.equal(f.window.listenerCount, 3);
  f.window.dispatch('focus');
  stop();
  stop();
  assert.equal(f.document.listenerCount, 0);
  assert.equal(f.window.listenerCount, 0);
  request.resolve();
  await flush();
  f.document.dispatch('visibilitychange');
  f.window.dispatch('focus');
  f.window.dispatch('online');
  f.timers.tick(90_000);
  assert.equal(calls, 1);
  assert.equal(f.timers.pending, 0);

  const settled = fixture();
  const cleanup = settled.start(async () => {});
  await flush();
  assert.equal(settled.timers.pending, 1);
  cleanup();
  assert.equal(settled.timers.pending, 0);
  assert.equal(settled.document.listenerCount + settled.window.listenerCount, 0);
});

const catalog = () => ({
  categories: [{ id: 'breakfast', name: 'Завтраки' }, { id: 'drinks', name: 'Напитки' }],
  products: [{ id: 'dish', name: 'Сырники', category: 'breakfast', price: 490, available: true, allergens: ['Молоко'] }],
  orderingEnabled: true,
  ordering: { method: 'pickup', payment: 'cash', online: true },
  warnings: ['Проверить состав'],
  fetchedAt: '2026-11-19T10:00:00.000Z',
  data: { raw: 'upstream snapshot' },
});

test('catalog comparison ignores fetchedAt/raw data and JSON object key order without mutating inputs', () => {
  const before = catalog();
  const after = structuredClone(before);
  after.fetchedAt = '2026-11-19T11:00:00.000Z';
  after.ordering = { online: true, payment: 'cash', method: 'pickup' };
  Object.defineProperty(after, 'data', { get() { throw new Error('Raw upstream data must not be read'); } });
  assert.equal(sameCatalogContent(before, after), true);
  assert.equal(before.fetchedAt, '2026-11-19T10:00:00.000Z');
  assert.equal(sameCatalogContent(null, after), false);
});

test('catalog comparison detects category/product/order state/warning changes and meaningful array order', () => {
  const changes = [
    changed => { changed.categories[0].name = 'Завтраки и кофе'; },
    changed => { changed.categories.reverse(); },
    changed => { changed.products[0].price = 500; },
    changed => { changed.products[0].available = false; },
    changed => { changed.products[0].allergens.push('Яйца'); },
    changed => { changed.products.push({ id: 'new' }); },
    changed => { changed.orderingEnabled = false; },
    changed => { changed.ordering.online = false; },
    changed => { changed.warnings = []; },
  ];
  const original = catalog();
  for (const change of changes) {
    const changed = structuredClone(original);
    change(changed);
    assert.equal(sameCatalogContent(original, changed), false);
  }
});
