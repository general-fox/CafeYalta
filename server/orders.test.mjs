import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { createOrderService, OrderError } from './orders.mjs';
import { createMemoryOrderStore, createFileOrderStore } from './order-store.mjs';
import { defaultModifierSelection, evaluateModifierSelection, cartLineId } from '../shared/modifiers.mjs';

const org = '11111111-1111-4111-8111-111111111111';
const group = '22222222-2222-4222-8222-222222222222';
const product = '33333333-3333-4333-8333-333333333333';
const size = '44444444-4444-4444-8444-444444444444';
const pickup = '55555555-5555-4555-8555-555555555555';
const courier = '55555555-5555-4555-8555-555555555556';
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
      return { orderTypes: [{ organizationId: org, items: [{ id: pickup, orderServiceType: 'DeliveryPickUp', isDeleted: false }, { id: courier, orderServiceType: 'DeliveryByCourier', isDeleted: false }] }] };
    },
    async organizationDetails(receivedOrg) {
      calls.push(['organizationDetails', receivedOrg]);
      return { organizations: [{ id: org, addressFormatType: 'Legacy' }] };
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
  assert.deepEqual(result.items, [{ id: 'dish-large', lineId: 'dish-large', name: 'Тестовое блюдо', basePrice: 110.25, price: 110.25, quantity: 2, selections: [], modifiers: [] }]);
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

const legacyAddress = () => ({ type: 'legacy', city: 'Москва', street: 'Тестовая', house: '1', building: '2', flat: '8', entrance: '1', floor: '3', doorphone: '8' });
const deliveryPayload = () => ({ ...payload(), method: 'delivery', address: legacyAddress() });

test('courier delivery uses the actual address format, courier type and unpaid cash for dishes only', async () => {
  const f = fixture();
  const supplied = { ...deliveryPayload(), deliveryFee: 199, gifts: [{ id: other, quantity: 1 }] };
  const result = await f.service.create(supplied, token);
  assert.equal(result.status, 'accepted');
  assert.equal(result.total, 220.5);
  const sent = f.calls.find(([name]) => name === 'createDelivery')[1];
  assert.equal(sent.order.orderTypeId, courier);
  assert.deepEqual(sent.order.deliveryPoint, { address: { type: 'legacy', street: { city: 'Москва', name: 'Тестовая' }, house: '1', building: '2', flat: '8', entrance: '1', floor: '3', doorphone: '8' } });
  assert.equal(sent.order.payments[0].sum, 220.5);
  assert.equal(sent.order.payments[0].isProcessedExternally, false);
  assert.equal(sent.order.items.length, 1);
  assert.equal(f.calls.filter(([name]) => name === 'stopList').length, 1);
  assert.doesNotMatch(JSON.stringify(await f.store.get(id)), /Москва|Тестовая|Тестовый гость|9000000000/);
});

test('city format is supported only when confirmed by the organization', async () => {
  const f = fixture({ client: { organizationDetails: async () => ({ organizations: [{ id: org, addressFormatType: 'City' }] }) } });
  const supplied = { ...deliveryPayload(), address: { type: 'city', line1: 'Москва, улица Тестовая, дом 1', flat: '8' } };
  await f.service.create(supplied, token);
  const sent = f.calls.find(([name]) => name === 'createDelivery')[1];
  assert.deepEqual(sent.order.deliveryPoint.address, supplied.address);
  assert.equal(sent.order.orderTypeId, courier);
});

test('missing or malformed courier addresses cannot reach preflight or create an order', async () => {
  for (const address of [undefined, null, {}, { type: 'city', line1: 'short' }, { ...legacyAddress(), city: '' }, { ...legacyAddress(), street: 'x'.repeat(61) }, { ...legacyAddress(), house: '\u0000' }, { ...legacyAddress(), flat: 'x'.repeat(11) }]) {
    const f = fixture();
    await assert.rejects(f.service.create({ ...deliveryPayload(), address }, token), rejection('INVALID_ADDRESS'));
    assert.equal(f.calls.length, 0);
    assert.equal(await f.store.get(id), null);
  }
});

test('courier requests fail before persistence when the format or order type is unsupported', async () => {
  for (const [client, expected] of [
    [{ organizationDetails: async () => ({ organizations: [{ id: org, addressFormatType: 'City' }] }) }, 'ADDRESS_FORMAT_UNAVAILABLE'],
    [{ organizationDetails: async () => ({ organizations: [{ id: org, addressFormatType: 'Unknown' }] }) }, 'ADDRESS_FORMAT_UNAVAILABLE'],
    [{ orderTypes: async () => ({ orderTypes: [{ organizationId: org, items: [{ id: pickup, orderServiceType: 'DeliveryPickUp' }] }] }) }, 'DELIVERY_UNAVAILABLE'],
  ]) {
    const f = fixture({ client });
    await assert.rejects(f.service.create(deliveryPayload(), token), rejection(expected));
    assert.equal(await f.store.get(id), null);
    assert.equal(f.calls.filter(([name]) => name === 'createDelivery').length, 0);
  }
});

test('same courier attempt can be retried but changing the method or address cannot create a second order', async () => {
  const f = fixture();
  await f.service.create(deliveryPayload(), token);
  assert.equal((await f.service.create(deliveryPayload(), token)).status, 'accepted');
  await assert.rejects(f.service.create({ ...deliveryPayload(), address: { ...legacyAddress(), house: '2' } }, token), rejection('REQUEST_CONFLICT'));
  await assert.rejects(f.service.create(payload(), token), rejection('REQUEST_CONFLICT'));
  assert.equal(f.calls.filter(([name]) => name === 'createDelivery').length, 1);
});

test('checkout capabilities expose the current address format and degrade to pickup when unknown', async () => {
  const f = fixture();
  assert.deepEqual(await f.service.capabilities(), { methods: ['pickup', 'delivery'], payment: 'cash_on_receipt', deliveryFee: 0, addressFormat: 'legacy' });
  await f.service.capabilities();
  assert.equal(f.calls.filter(([name]) => name === 'organizationDetails').length, 1);
  const unavailable = fixture({ client: { organizationDetails: async () => { throw new Error('private upstream detail'); } } });
  const capabilities = await unavailable.service.capabilities();
  assert.deepEqual(capabilities.methods, ['pickup']);
  assert.equal(capabilities.addressFormat, null);
  assert.doesNotMatch(JSON.stringify(capabilities), /private upstream/);
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
    { method: 'unknown' }, { items: [] }, { items: [{ id: 'dish-large', quantity: 0 }] },
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

const modifierGroup = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const sauce = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const cheese = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const choose = (modifierId = sauce, quantity = 1, groupId = modifierGroup) => ({ groupId, modifierId, quantity });
const modifierOption = (id, price, changes = {}) => ({ id, productId: id, name: id === sauce ? 'Соус' : 'Сыр',
  price, priceCents: Math.round(price * 100), minQuantity: 0, maxQuantity: 2, freeQuantity: 0, defaultQuantity: 0, available: true, ...changes });
const configuredEntry = (changes = {}) => ({ ...entry(), orderItemType: 'Product', modifierGroups: [{
  id: modifierGroup, productGroupId: modifierGroup, name: 'Добавки', minQuantity: 1, maxQuantity: 2, freeQuantity: 0,
  defaultQuantity: 0, required: true, splittable: false, items: [modifierOption(sauce, 25), modifierOption(cheese, 50)],
}], ...changes });
const modifierFixture = (item = configuredEntry(), options = {}) => fixture({ getCatalog: async () => ({ entries: new Map([['dish-large', item]]) }), ...options });

test('modifier helpers initialize defaults only when requested and preserve distinct line identities', () => {
  const item = configuredEntry();
  item.modifierGroups[0].items[0].defaultQuantity = 1;
  assert.deepEqual(defaultModifierSelection(item), [choose()]);
  assert.equal(evaluateModifierSelection(item, []).valid, false);
  const result = evaluateModifierSelection(item, [choose()]);
  assert.equal(result.valid, true);
  assert.equal(result.unitPriceCents, 13525);
  assert.equal(evaluateModifierSelection({ ...item, basePrice: 110.25, price: 135.25 }, [choose()]).unitPriceCents, 13525);
  assert.equal(evaluateModifierSelection({ price: 250 }, []).unitPrice, 250);
  assert.equal(cartLineId('plain', []), 'plain');
  assert.equal(cartLineId('dish', [choose(), choose(cheese)]), cartLineId('dish', [choose(cheese), choose()]));
  assert.notEqual(cartLineId('dish', [choose()]), cartLineId('dish', [choose(cheese)]));
});

test('selected modifier prices are authoritative and each configured portion reaches stop-list and iiko intact', async () => {
  const f = modifierFixture();
  const supplied = { ...payload(), items: [{ id: 'dish-large', quantity: 2, selections: [{ ...choose(), price: 0, productId: other }] }], expectedTotal: 270.5 };
  const result = await f.service.create(supplied, token);
  assert.equal(result.total, 270.5);
  assert.equal(result.items[0].basePrice, 110.25);
  assert.equal(result.items[0].price, 135.25);
  assert.deepEqual(result.items[0].selections, [choose()]);
  assert.deepEqual(result.items[0].modifiers, [{ ...choose(), name: 'Соус', price: 25 }]);
  const sent = f.calls.find(([name]) => name === 'createDelivery')[1];
  const expectedItem = { type: 'Product', amount: 1, productSizeId: size, productId: product, price: 110.25,
    modifiers: [{ productId: sauce, productGroupId: modifierGroup, amount: 1, price: 25 }] };
  assert.deepEqual(sent.order.items, [expectedItem, expectedItem]);
  assert.deepEqual(f.calls.find(([name]) => name === 'stopList')[1].items, sent.order.items);
  assert.equal(sent.order.payments[0].sum, 270.5);
  assert.deepEqual((await f.store.get(id)).items[0].selections, [choose()]);
});

test('same product with different choices remains separate, while identical choices merge', async () => {
  const f = modifierFixture();
  const supplied = { ...payload(), items: [
    { id: 'dish-large', quantity: 1, selections: [choose()] },
    { id: 'dish-large', quantity: 1, selections: [choose(cheese)] },
    { id: 'dish-large', quantity: 1, selections: [choose()] },
  ], expectedTotal: 430.75 };
  const result = await f.service.create(supplied, token);
  assert.equal(result.items.length, 2);
  assert.equal(new Set(result.items.map(item => item.lineId)).size, 2);
  assert.equal(result.items.find(item => item.selections[0].modifierId === sauce).quantity, 2);
  assert.equal(f.calls.find(([name]) => name === 'createDelivery')[1].order.items.length, 3);
});

test('invalid selections, stale groups and restrictions cannot reach order creation', async () => {
  const variants = [
    [], [choose(other)], [choose(sauce, 1, other)], [choose(), choose()], [choose(sauce, 0)], [choose(sauce, -1)],
    [choose(sauce, 0.5)], [choose(sauce, 3)], [choose(sauce, 2), choose(cheese)], null, {},
  ];
  for (const selections of variants) {
    const f = modifierFixture();
    await assert.rejects(f.service.create({ ...payload(), items: [{ id: 'dish-large', quantity: 1, selections }], expectedTotal: 135.25 }, token), rejection('INVALID_MODIFIERS'));
    assert.equal(f.calls.filter(([name]) => name === 'createDelivery' || name === 'stopList').length, 0);
    assert.equal(await f.store.get(id), null);
  }
  const changed = configuredEntry();
  changed.modifierGroups[0].items[1].minQuantity = 1;
  const f = modifierFixture(changed);
  await assert.rejects(f.service.create({ ...payload(), items: [{ id: 'dish-large', quantity: 1, selections: [choose()] }], expectedTotal: 135.25 }, token), rejection('INVALID_MODIFIERS'));
});

test('required defaults are not silently added and removing optional defaults is explicitly sent as zero', async () => {
  const item = configuredEntry();
  item.modifierGroups[0].items[0].defaultQuantity = 1;
  const required = modifierFixture(item);
  await assert.rejects(required.service.create(payload(), token), rejection('INVALID_MODIFIERS'));
  item.modifierGroups[0].minQuantity = 0;
  item.modifierGroups[0].required = false;
  const optional = modifierFixture(item);
  const result = await optional.service.create({ ...payload(), items: [{ id: 'dish-large', quantity: 2, selections: [] }] }, token);
  assert.equal(result.total, 220.5);
  assert.deepEqual(result.items[0].modifiers, []);
  const items = optional.calls.find(([name]) => name === 'createDelivery')[1].order.items;
  assert.equal(items.length, 2);
  assert.deepEqual(items[0].modifiers, [{ productId: sauce, productGroupId: modifierGroup, amount: 0, price: 25 }]);
});

test('unsplit compound sends common and splittable choices in their respective API fields', async () => {
  const item = configuredEntry({ orderItemType: 'Compound' });
  item.modifierGroups[0].id = 'ungrouped:sauces';
  delete item.modifierGroups[0].productGroupId;
  item.modifierGroups[0].items = [modifierOption(sauce, 25)];
  item.modifierGroups.push({ id: modifierGroup, productGroupId: modifierGroup, name: 'Начинка', minQuantity: 1, maxQuantity: 1,
    freeQuantity: 0, defaultQuantity: 0, splittable: true, items: [modifierOption(cheese, 50)] });
  const f = modifierFixture(item);
  const selections = [choose(sauce, 1, 'ungrouped:sauces'), choose(cheese)];
  await f.service.create({ ...payload(), items: [{ id: 'dish-large', quantity: 1, selections }], expectedTotal: 185.25 }, token);
  const sent = f.calls.find(([name]) => name === 'createDelivery')[1].order.items[0];
  assert.deepEqual(sent, { type: 'Compound', amount: 1, productSizeId: size,
    primaryComponent: { productId: product, price: 110.25, modifiers: [{ productId: cheese, productGroupId: modifierGroup, amount: 1, price: 50 }] },
    commonModifiers: [{ productId: sauce, amount: 1, price: 25 }] });
  assert.deepEqual(f.calls.find(([name]) => name === 'stopList')[1].items, [sent]);
});

test('fresh modifier price, availability and stop-list changes reject before a durable claim', async () => {
  const supplied = { ...payload(), items: [{ id: 'dish-large', quantity: 1, selections: [choose()] }], expectedTotal: 135.25 };
  const priceChanged = configuredEntry();
  priceChanged.modifierGroups[0].items[0].price = 30;
  priceChanged.modifierGroups[0].items[0].priceCents = 3000;
  await assert.rejects(modifierFixture(priceChanged).service.create(supplied, token), rejection('PRICE_CHANGED'));
  const unavailable = configuredEntry();
  unavailable.modifierGroups[0].items[0].available = false;
  await assert.rejects(modifierFixture(unavailable).service.create(supplied, token), rejection('INVALID_MODIFIERS'));
  const stopped = modifierFixture(configuredEntry(), { client: { async checkStopList() { return { correlationId: correlation, rejectedItems: [{ productId: sauce, balance: 0 }] }; } } });
  await assert.rejects(stopped.service.create(supplied, token), rejection('ITEM_UNAVAILABLE'));
  assert.equal(await stopped.store.get(id), null);
  assert.equal(stopped.calls.filter(([name]) => name === 'createDelivery').length, 0);
});

test('modifier choices participate in idempotency and frozen snapshots survive catalogue changes', async () => {
  const item = configuredEntry();
  const f = modifierFixture(item);
  const supplied = { ...payload(), items: [{ id: 'dish-large', quantity: 1, selections: [choose(), choose(cheese)] }], expectedTotal: 185.25 };
  const initial = await f.service.create(supplied, token);
  item.modifierGroups[0].items[0].name = 'Новое название';
  item.modifierGroups[0].items[0].price = 999;
  item.modifierGroups[0].items[0].priceCents = 99900;
  const reordered = { ...supplied, items: [{ id: 'dish-large', quantity: 1, selections: [choose(cheese), choose()] }] };
  assert.deepEqual(await f.service.create(reordered, token), initial);
  await assert.rejects(f.service.create({ ...supplied, items: [{ id: 'dish-large', quantity: 1, selections: [choose(cheese)] }] }, token), rejection('REQUEST_CONFLICT'));
  assert.deepEqual((await f.service.get(id, token)).items, initial.items);
  assert.equal(f.calls.filter(([name]) => name === 'createDelivery').length, 1);
});

test('unsupported free quantities and inconsistent modifier prices fail closed', () => {
  for (const change of [{ freeQuantity: 1 }, { priceCents: 1 }, { maxQuantity: 0 }]) {
    const item = configuredEntry();
    Object.assign(item.modifierGroups[0].items[0], change);
    assert.equal(evaluateModifierSelection(item, [choose()]).valid, false);
  }
  const item = configuredEntry();
  item.modifierGroups[0].freeQuantity = 1;
  assert.equal(evaluateModifierSelection(item, [choose()]).valid, false);
});
