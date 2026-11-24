import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { createOrderService, OrderError } from './orders.mjs';
import { createMemoryOrderStore, createFileOrderStore } from './order-store.mjs';

const org = '11111111-1111-4111-8111-111111111111';
const group = '22222222-2222-4222-8222-222222222222';
const product = '33333333-3333-4333-8333-333333333333';
const size = '44444444-4444-4444-8444-444444444444';
const pickup = '55555555-5555-4555-8555-555555555555';
const cash = '66666666-6666-4666-8666-666666666666';
const id = '77777777-7777-4777-8777-777777777777';
const correlation = '88888888-8888-4888-8888-888888888888';
const other = '99999999-9999-4999-8999-999999999999';
const token = '12345678-1234-4234-8234-123456789abc';
const otherToken = 'abcdef12-abcd-4abc-8abc-abcdef123456';
const config = () => ({ orderingEnabled: true, selection: { organizationId: org, terminalGroupId: group, externalMenuId: '98308' } });
const entry = () => ({ id: 'dish-large', productId: product, sizeId: size, name: 'Тестовое блюдо', price: 110.25, priceCents: 11025, available: true });
const payload = () => ({ requestId: id, method: 'pickup', customer: { name: 'Тестовый гость', phone: '+7 (900) 000-00-00' }, comment: 'Тестовый заказ', items: [{ id: 'dish-large', quantity: 2 }], expectedTotal: 220.5 });
const info = (creationStatus = 'Success', overrides = {}) => ({ id, organizationId: org, creationStatus, order: creationStatus === 'Success' ? { number: 42, terminalGroupId: group } : null, ...overrides });
const rejection = code => error => error instanceof OrderError && error.code === code;

function fixture(options = {}) {
  const calls = [];
  const store = options.store || createMemoryOrderStore();
  const client = {
    async orderTypes(receivedOrg) {
      calls.push(['orderTypes', receivedOrg]);
      return { orderTypes: [{ organizationId: org, items: [{ id: pickup, orderServiceType: 'DeliveryPickUp', isDeleted: false }] }] };
    },
    async paymentTypes(receivedOrg) {
      calls.push(['paymentTypes', receivedOrg]);
      return { paymentTypes: [{ id: cash, paymentTypeKind: 'Cash', paymentProcessingType: 'Internal', isDeleted: false, terminalGroups: [{ id: group }] }] };
    },
    async terminalGroupsAlive(...args) { calls.push(['alive', ...args]); return { isAliveStatus: [{ organizationId: org, terminalGroupId: group, isAlive: true }] }; },
    async checkStopList(body) { calls.push(['stopList', body]); return { correlationId: correlation }; },
    async createDelivery(body) { calls.push(['createDelivery', body]); return { correlationId: correlation, orderInfo: info() }; },
    async deliveriesById(body) { calls.push(['deliveriesById', body]); return { orders: [] }; },
    async commandStatus(body) { calls.push(['commandStatus', body]); return { state: 'InProgress' }; },
    ...options.client,
  };
  const getCatalog = options.getCatalog || (async received => { calls.push(['catalog', received]); return { entries: new Map([['dish-large', entry()]]) }; });
  const settings = options.config || config();
  const service = createOrderService({ config: settings, client, getCatalog, store, now: () => 1_800_000_000_000 });
  return { service, client, store, calls, config: settings, getCatalog };
}

test('pickup uses authoritative prices, dictionary IDs and unpaid cash; persists before creating', async () => {
  const f = fixture();
  const supplied = payload();
  supplied.items[0].price = 1;
  supplied.items[0].productId = other;
  supplied.gifts = [{ id: other, quantity: 100 }];
  const baseCreate = f.client.createDelivery;
  f.client.createDelivery = async body => {
    const saved = await f.store.get(id);
    assert.equal(saved.status, 'processing');
    assert.equal(saved.accessTokenHash, createHash('sha256').update(token).digest('hex'));
    assert.equal(saved.fingerprint.length, 64);
    assert.equal(body.order.id, saved.id);
    assert.doesNotMatch(JSON.stringify(saved), /Тестовый гость|9000000000|Тестовый заказ|12345678-1234/);
    return baseCreate(body);
  };
  const result = await f.service.create(supplied, token);
  assert.equal(result.status, 'accepted');
  assert.equal(result.total, 220.5);
  assert.equal(result.number, 42);
  assert.deepEqual(Object.keys(result).sort(), ['createdAt', 'id', 'items', 'message', 'number', 'status', 'total']);
  assert.deepEqual(result.items, [{ id: 'dish-large', name: 'Тестовое блюдо', price: 110.25, quantity: 2 }]);
  const sent = f.calls.find(([name]) => name === 'createDelivery')[1];
  assert.deepEqual(sent.order.items, [{ type: 'Product', productId: product, productSizeId: size, amount: 2, price: 110.25 }]);
  assert.equal(sent.organizationId, org);
  assert.equal(sent.terminalGroupId, group);
  assert.equal(sent.order.orderTypeId, pickup);
  assert.equal(sent.order.orderServiceType, undefined);
  assert.equal(sent.order.phone, '+79000000000');
  assert.equal(sent.order.customer.type, 'one-time');
  assert.equal(sent.order.menuId, '98308');
  assert.deepEqual(sent.order.payments, [{ paymentTypeKind: 'Cash', paymentTypeId: cash, sum: 220.5, isProcessedExternally: false, isFiscalizedExternally: false }]);
  assert.deepEqual(sent.createOrderSettings, { checkStopList: true });
  assert.deepEqual(f.calls.find(([name]) => name === 'catalog')[1], { fresh: true });
});

test('a changed total is rejected before a durable claim or any create call', async () => {
  const f = fixture();
  const supplied = { ...payload(), expectedTotal: 1 };
  await assert.rejects(f.service.create(supplied, token), rejection('PRICE_CHANGED'));
  assert.equal(await f.store.get(id), null);
  assert.equal(f.calls.filter(([name]) => name === 'createDelivery').length, 0);
});

test('unknown, unavailable and required-modifier items cannot be sent', async () => {
  for (const change of [undefined, { available: false }, { requiresModifiers: true }]) {
    const f = fixture({ getCatalog: async () => ({ entries: new Map(change === undefined ? [] : [['dish-large', { ...entry(), ...change }]]) }) });
    await assert.rejects(f.service.create(payload(), token), rejection('ITEM_UNAVAILABLE'));
    assert.equal(await f.store.get(id), null);
    assert.equal(f.calls.filter(([name]) => name === 'createDelivery').length, 0);
  }
});

test('validates quantity bounds, duplicate aggregate quantities, money, pickup and customer input', async () => {
  for (const change of [
    { method: 'delivery' }, { items: [] }, { items: [{ id: 'dish-large', quantity: 0 }] },
    { items: [{ id: 'dish-large', quantity: 31 }] }, { items: [{ id: 'dish-large', quantity: 1.5 }] },
    { items: [{ id: 'dish-large', quantity: 20 }, { id: 'dish-large', quantity: 20 }] },
    { expectedTotal: '220.5' }, { expectedTotal: 0.001 }, { customer: { name: '', phone: '+79000000000' } },
    { customer: { name: 'Тест', phone: 'token=secret' } },
  ]) {
    const f = fixture();
    await assert.rejects(f.service.create({ ...payload(), ...change }, token), rejection('INVALID_ORDER'));
    assert.equal(f.calls.length, 0);
    assert.equal(await f.store.get(id), null);
  }
});

test('preflight requires online POS, pickup order type, applicable cash and valid stop-list result', async () => {
  const cases = [
    [{ terminalGroupsAlive: async () => ({ isAliveStatus: [{ organizationId: org, terminalGroupId: group, isAlive: false }] }) }, 'POS_UNAVAILABLE'],
    [{ orderTypes: async () => ({ orderTypes: [{ organizationId: org, items: [{ id: pickup, orderServiceType: 'DeliveryByCourier' }] }] }) }, 'PICKUP_UNAVAILABLE'],
    [{ orderTypes: async () => ({ orderTypes: [{ organizationId: org, items: [{ id: pickup, orderServiceType: 'DeliveryPickUp', isDeleted: true }] }] }) }, 'PICKUP_UNAVAILABLE'],
    [{ paymentTypes: async () => ({ paymentTypes: [{ id: cash, paymentTypeKind: 'Cash', terminalGroups: [{ id: other }] }] }) }, 'CASH_PAYMENT_UNAVAILABLE'],
    [{ paymentTypes: async () => ({ paymentTypes: [{ id: cash, paymentTypeKind: 'Card', terminalGroups: [{ id: group }] }] }) }, 'CASH_PAYMENT_UNAVAILABLE'],
    [{ checkStopList: async () => ({ correlationId: correlation, rejectedItems: [{ productId: product, balance: 0 }] }) }, 'ITEM_UNAVAILABLE'],
    [{ checkStopList: async () => ({}) }, 'IIKO_UNAVAILABLE'],
  ];
  for (const [client, code] of cases) {
    const f = fixture({ client });
    await assert.rejects(f.service.create(payload(), token), rejection(code));
    assert.equal(await f.store.get(id), null);
    assert.equal(f.calls.filter(([name]) => name === 'createDelivery').length, 0);
  }
});

test('simultaneous identical requests create one iiko order, and retries use the original snapshot', async () => {
  const f = fixture();
  const results = await Promise.all(Array.from({ length: 8 }, () => f.service.create(payload(), token)));
  assert.ok(results.every(result => result.status === 'accepted' && result.id === id));
  assert.equal(f.calls.filter(([name]) => name === 'createDelivery').length, 1);
  assert.equal(f.calls.filter(([name]) => name === 'catalog').length, 1);
  f.config.orderingEnabled = false;
  assert.equal((await f.service.create(payload(), token)).status, 'accepted');
  assert.equal((await f.service.get(id, token)).total, 220.5);
});

test('an existing request rejects changed or malformed payloads without allowing a second send', async () => {
  const f = fixture();
  await f.service.create(payload(), token);
  for (const change of [{ expectedTotal: 1 }, { comment: 'Другой комментарий' }, { items: [] }]) {
    await assert.rejects(f.service.create({ ...payload(), ...change }, token), rejection('REQUEST_CONFLICT'));
  }
  assert.equal(f.calls.filter(([name]) => name === 'createDelivery').length, 1);
});

test('a capability is required and another browser receives no order information or upstream lookup', async () => {
  const f = fixture();
  await f.service.create(payload(), token);
  const previousCalls = f.calls.length;
  for (const bad of [undefined, 'short', otherToken]) {
    await assert.rejects(f.service.get(id, bad), rejection('ORDER_NOT_FOUND'));
    await assert.rejects(f.service.create(payload(), bad), rejection('ORDER_NOT_FOUND'));
  }
  await assert.rejects(f.service.get(other, token), rejection('ORDER_NOT_FOUND'));
  await assert.rejects(f.service.get('../../.env', token), rejection('ORDER_NOT_FOUND'));
  assert.equal(f.calls.length, previousCalls);
});

test('network errors after POST stay processing; later reads recover the persisted ID without replay', async () => {
  let submissions = 0;
  const f = fixture({ client: {
    async createDelivery() { submissions++; throw new Error('private upstream token=do-not-expose'); },
    async deliveriesById(body) { assert.deepEqual(body, { organizationId: org, orderIds: [id] }); return { orders: [info()] }; },
  } });
  const result = await f.service.create(payload(), token);
  assert.equal(result.status, 'processing');
  assert.doesNotMatch(JSON.stringify(result), /private|do-not-expose|token/);
  const restarted = createOrderService({ config: f.config, client: f.client, getCatalog: async () => { throw new Error('Must not reload menu for existing request'); }, store: f.store });
  assert.equal((await restarted.get(id, token)).status, 'accepted');
  assert.equal((await restarted.create(payload(), token)).status, 'accepted');
  assert.equal(submissions, 1);
});

test('HTTP success and command Success alone never claim an order was accepted', async () => {
  const f = fixture({ client: {
    async createDelivery() { return { correlationId: correlation, orderInfo: info('InProgress') }; },
    async commandStatus() { return { state: 'Success' }; },
  } });
  assert.equal((await f.service.create(payload(), token)).status, 'processing');
  assert.equal((await f.service.get(id, token)).status, 'processing');
  f.client.deliveriesById = async () => ({ orders: [info('Success', { id: other })] });
  assert.equal((await f.service.get(id, token)).status, 'processing');
  f.client.deliveriesById = async () => ({ orders: [info('Success', { organizationId: other })] });
  assert.equal((await f.service.get(id, token)).status, 'processing');
  f.client.deliveriesById = async () => ({ orders: [info()] });
  assert.equal((await f.service.get(id, token)).status, 'accepted');
});

test('creation Success requires order evidence for the selected terminal on both POST and later reads', async () => {
  for (const order of [undefined, null, {}, { number: 42 }, { number: 42, terminalGroupId: other }]) {
    let submissions = 0;
    const unconfirmed = info('Success', { order });
    const f = fixture({ client: {
      async createDelivery() { submissions++; return { correlationId: correlation, orderInfo: unconfirmed }; },
      async deliveriesById() { return { orders: [unconfirmed] }; },
      async commandStatus() { return { state: 'Success' }; },
    } });
    const created = await f.service.create(payload(), token);
    assert.equal(created.status, 'processing');
    assert.equal(created.number, undefined);
    assert.equal((await f.service.get(id, token)).status, 'processing');
    assert.equal((await f.store.get(id)).status, 'processing');
    f.client.deliveriesById = async () => ({ orders: [info()] });
    assert.equal((await f.service.get(id, token)).status, 'accepted');
    assert.equal(submissions, 1);
  }
});

test('definitive creation rejection and command rejection are safely persisted', async () => {
  const direct = fixture({ client: { async createDelivery() { return { correlationId: correlation, orderInfo: { ...info('Error'), errorInfo: { message: 'secret' } } }; } } });
  const result = await direct.service.create(payload(), token);
  assert.equal(result.status, 'failed');
  assert.doesNotMatch(JSON.stringify(result), /secret/);
  assert.equal((await direct.store.get(id)).status, 'failed');
  const asynchronous = fixture({ client: {
    async createDelivery() { return { correlationId: correlation, orderInfo: info('InProgress') }; },
    async commandStatus() { return { state: 'Error', errorReason: 'private upstream details' }; },
  } });
  assert.equal((await asynchronous.service.create(payload(), token)).status, 'processing');
  assert.equal((await asynchronous.service.get(id, token)).status, 'failed');
});

test('a status read outage remains processing and confirmed order evidence is required with command Success', async () => {
  const f = fixture({ client: {
    async createDelivery() { return { correlationId: correlation, orderInfo: info('InProgress') }; },
    deliveriesById() { throw new Error('read outage with private details'); },
    commandStatus() { throw new Error('read outage'); },
  } });
  await f.service.create(payload(), token);
  const pending = await f.service.get(id, token);
  assert.equal(pending.status, 'processing');
  assert.doesNotMatch(JSON.stringify(pending), /private details|outage/);
  f.client.commandStatus = async () => ({ state: 'Success' });
  f.client.deliveriesById = async () => ({ orders: [info('InProgress', { order: { number: 43, terminalGroupId: other } })] });
  assert.equal((await f.service.get(id, token)).status, 'processing');
  f.client.deliveriesById = async () => ({ orders: [info('InProgress', { order: { number: 43, terminalGroupId: group } })] });
  assert.equal((await f.service.get(id, token)).status, 'accepted');
});

test('failed persistence blocks POST and failures while saving the response retain a durable processing claim', async () => {
  let submissions = 0;
  const client = { async createDelivery() { submissions++; return { correlationId: correlation, orderInfo: info() }; } };
  const failed = fixture({ client, store: { async get() { return null; }, async create() { throw new Error('disk full'); } } });
  await assert.rejects(failed.service.create(payload(), token), rejection('ORDER_STORAGE_UNAVAILABLE'));
  assert.equal(submissions, 0);
  const backing = createMemoryOrderStore();
  const after = fixture({ client, store: { ...backing, async save() { throw new Error('disk full'); } } });
  assert.equal((await after.service.create(payload(), token)).status, 'processing');
  assert.equal((await backing.get(id)).status, 'processing');
  assert.equal(submissions, 1);
});

test('file store survives a service restart and atomically inserts only one claim', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'cafe-orders-test-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const store = createFileOrderStore({ directory });
  const f = fixture({ store, client: { async createDelivery() { throw new Error('timeout'); } } });
  assert.equal((await f.service.create(payload(), token)).status, 'processing');
  const raw = await readFile(join(directory, `${id}.json`), 'utf8');
  assert.doesNotMatch(raw, new RegExp(token));
  assert.equal(JSON.parse(raw).fingerprint.length, 64);
  const secondStore = createFileOrderStore({ directory });
  const recovered = fixture({ store: secondStore, client: { async deliveriesById() { return { orders: [info()] }; } } });
  assert.equal((await recovered.service.create(payload(), token)).status, 'accepted');
  assert.equal(recovered.calls.filter(([name]) => name === 'createDelivery').length, 0);
  const raceRecord = { id: other, data: 'complete JSON' };
  const inserts = await Promise.all([store.create(raceRecord), secondStore.create(raceRecord), store.create(raceRecord)]);
  assert.equal(inserts.filter(Boolean).length, 1);
  assert.deepEqual(await secondStore.get(other), raceRecord);
  assert.ok((await readdir(directory)).every(name => name.endsWith('.json')));
  await assert.rejects(store.get('../secrets'));
});

test('a corrupt persisted claim fails closed rather than making another iiko order', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'cafe-orders-corrupt-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  await writeFile(join(directory, `${id}.json`), '{broken');
  const f = fixture({ store: createFileOrderStore({ directory }) });
  await assert.rejects(f.service.create(payload(), token), rejection('ORDER_STORAGE_UNAVAILABLE'));
  assert.equal(f.calls.length, 0);
});
