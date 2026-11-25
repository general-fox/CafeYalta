import test from 'node:test';
import assert from 'node:assert/strict';
import { apiRequest, CHECKOUT_STORAGE_KEY, commitCheckoutTransition, configuredIikoProduct, createCheckoutAttempt, isOrderPending, persistCheckoutAttempt, readCheckoutAttempt, reconcileIikoCart, SAFE_REJECTION_CODES, validateOrderResult } from '../src/iiko.js';
import { cartTotal, changeQuantity } from '../src/domain.js';

const requestId = '11111111-2222-4333-8444-555555555555';
const token = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
const product = { id: 'food', name: 'Блюдо', source: 'iiko', price: 250, available: true };
function memoryStorage() {
  const data = new Map();
  return { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value), removeItem: key => data.delete(key) };
}

const sauceDish = { ...product, price: 200, modifierGroups: [{ id: 'sauces', name: 'Соусы', minQuantity: 0, maxQuantity: 2, defaultQuantity: 0, freeQuantity: 0,
  items: ['red', 'white'].map(id => ({ id, name: id === 'red' ? 'Сацебели' : 'Цахтон', price: 50, minQuantity: 0, maxQuantity: 1, defaultQuantity: 0, freeQuantity: 0, available: true })) }] };
const redSauce = [{ groupId: 'sauces', modifierId: 'red', quantity: 1 }];
const whiteSauce = [{ groupId: 'sauces', modifierId: 'white', quantity: 1 }];

test('different modifier combinations stay separate while identical combinations merge in the cart', () => {
  const red = configuredIikoProduct(sauceDish, redSauce);
  const white = configuredIikoProduct(sauceDish, whiteSauce);
  let cart = changeQuantity([], red, 1);
  cart = changeQuantity(cart, white, 1);
  cart = changeQuantity(cart, red, 1);
  assert.equal(cart.length, 2);
  assert.equal(cart[0].quantity, 2);
  assert.equal(cart[1].quantity, 1);
  assert.equal(cartTotal(cart), 750);
  cart = changeQuantity(cart, white, -1);
  assert.equal(cart.length, 1);
  assert.equal(cart[0].lineId, red.lineId);
});

test('menu refresh reprices the exact modifiers and blocks removed choices without silently dropping them', () => {
  const saved = { ...configuredIikoProduct(sauceDish, redSauce), quantity: 2 };
  const changed = structuredClone(sauceDish);
  changed.modifierGroups[0].items[0].price = 75;
  const refreshed = reconcileIikoCart([saved], [changed])[0];
  assert.equal(refreshed.price, 275);
  assert.equal(refreshed.quantity, 2);
  assert.deepEqual(refreshed.selections, redSauce);
  changed.modifierGroups[0].items.shift();
  const unavailable = reconcileIikoCart([saved], [changed])[0];
  assert.equal(unavailable.available, false);
  assert.deepEqual(unavailable.selections, redSauce);
  assert.equal(unavailable.modifiers[0].name, 'Сацебели');
});

test('new mandatory modifier rules invalidate an existing empty choice and legacy unconfigured cart', () => {
  const required = structuredClone(sauceDish);
  required.modifierGroups[0].minQuantity = 1;
  const saved = { ...configuredIikoProduct(sauceDish, []), quantity: 1 };
  assert.equal(reconcileIikoCart([saved], [required])[0].available, false);
  assert.equal(reconcileIikoCart([{ ...product, quantity: 1 }], [sauceDish])[0].available, false);
  assert.throws(() => configuredIikoProduct(required, []));
});

test('checkout preserves modifier selections per portion and freezes independent snapshots for recovery', () => {
  const configured = { ...configuredIikoProduct(sauceDish, redSauce), quantity: 2 };
  const ids = [requestId, token];
  const attempt = createCheckoutAttempt({ cart: [configured], customer: { name: 'Тест', phone: '+79990000000' }, uuid: () => ids.shift() });
  assert.deepEqual(attempt.payload.items, [{ id: product.id, quantity: 2, selections: redSauce }]);
  assert.equal(attempt.payload.expectedTotal, 500);
  configured.selections[0].quantity = 2;
  assert.equal(attempt.payload.items[0].selections[0].quantity, 1);
  assert.equal(attempt.snapshotItems[0].selections[0].quantity, 1);
  const storage = memoryStorage();
  persistCheckoutAttempt(storage, attempt);
  assert.deepEqual(readCheckoutAttempt(storage), attempt);
  assert.ok(SAFE_REJECTION_CODES.has('INVALID_MODIFIERS'));
});

test('iiko cart reload replaces stale prices and marks missing dishes unavailable without losing quantities', () => {
  const saved = [{ ...product, price: 1, quantity: 2 }, { id: 'old', name: 'Старое блюдо', price: 100, quantity: 1 }];
  const reconciled = reconcileIikoCart(saved, [product]);
  assert.equal(reconciled[0].price, 250);
  assert.equal(reconciled[0].quantity, 2);
  assert.equal(reconciled[1].available, false);
  assert.equal(reconciled[1].id, 'old');
  assert.equal(saved[0].price, 1);
});

test('checkout recovery retains the same request, capability and submitted total for a retry', () => {
  const ids = [requestId, token];
  const attempt = createCheckoutAttempt({ cart: [{ ...product, quantity: 2 }], customer: { name: 'Тест', phone: '+79990000000' }, uuid: () => ids.shift(), now: () => '2026-11-08T10:00:00.000Z' });
  const storage = memoryStorage();
  persistCheckoutAttempt(storage, attempt);
  const recovered = readCheckoutAttempt(storage);
  assert.deepEqual(recovered, attempt);
  assert.deepEqual(recovered.payload.items, [{ id: 'food', quantity: 2 }]);
  assert.equal(recovered.payload.expectedTotal, 500);
  assert.equal(recovered.payload.method, 'pickup');
  assert.equal(recovered.token, token);
  assert.equal(recovered.payload.requestId, requestId);
  assert.equal(isOrderPending(recovered), true);
  assert.equal(isOrderPending({ ...recovered, result: { status: 'processing' } }), true);
  assert.equal(isOrderPending({ ...recovered, result: { status: 'accepted' } }), false);
  assert.equal(isOrderPending({ ...recovered, result: { status: 'failed' } }), false);
});

test('courier checkout recovery retains address and method without synthetic fees or mutable address references', () => {
  const ids = [requestId, token];
  const address = { type: 'legacy', city: 'Москва', street: 'Тестовая', house: '1', flat: '8' };
  const customer = { name: 'Тест', phone: '+79990000000' };
  const attempt = createCheckoutAttempt({ cart: [{ ...product, quantity: 2 }], customer, method: 'delivery', address, uuid: () => ids.shift() });
  address.house = '5';
  customer.name = 'Изменённое имя';
  const storage = memoryStorage();
  persistCheckoutAttempt(storage, attempt);
  const recovered = readCheckoutAttempt(storage);
  assert.equal(recovered.payload.method, 'delivery');
  assert.equal(recovered.payload.address.house, '1');
  assert.equal(recovered.payload.customer.name, 'Тест');
  assert.equal(recovered.payload.expectedTotal, 500);
  assert.equal(recovered.payload.deliveryFee, undefined);
  assert.deepEqual(recovered.payload.items, [{ id: 'food', quantity: 2 }]);
  assert.throws(() => createCheckoutAttempt({ cart: [], customer, method: 'delivery' }), /адрес/);
});

test('checkout persistence failure is reported before a caller can send the attempt', () => {
  const storage = { setItem() { throw new Error('Storage disabled'); } };
  assert.throws(() => persistCheckoutAttempt(storage, { requestId }), /Storage disabled/);
  const malformed = memoryStorage();
  malformed.setItem(CHECKOUT_STORAGE_KEY, JSON.stringify({ requestId, token, payload: { requestId: 'different', items: [] }, snapshotItems: [] }));
  assert.throws(() => readCheckoutAttempt(malformed), /INVALID_SAVED_ORDER/);
});

test('a late response from an earlier checkout cannot clear or replace a newer pending request', () => {
  const storage = memoryStorage();
  const newer = { requestId: '99999999-2222-4333-8444-555555555555' };
  const reference = { current: newer };
  persistCheckoutAttempt(storage, newer);
  assert.equal(commitCheckoutTransition(storage, reference, null, requestId), false);
  assert.equal(commitCheckoutTransition(storage, reference, { requestId, result: { status: 'accepted' } }, requestId), false);
  assert.equal(reference.current, newer);
  assert.equal(JSON.parse(storage.getItem(CHECKOUT_STORAGE_KEY)).requestId, newer.requestId);
});

test('a confirmed result cannot be downgraded by a late processing response or preflight rejection', () => {
  const storage = memoryStorage();
  const confirmed = { requestId, result: { status: 'accepted' }, cartCleared: true };
  const reference = { current: confirmed };
  assert.equal(commitCheckoutTransition(storage, reference, { requestId, result: { status: 'processing' } }, requestId), false);
  assert.equal(commitCheckoutTransition(storage, reference, null, requestId), false);
  assert.equal(reference.current, confirmed);
  assert.equal(commitCheckoutTransition(storage, reference, null, requestId, { clearTerminal: true }), true);
});

test('conflicts and missing orders never authorize a new request', () => {
  for (const code of ['REQUEST_CONFLICT', 'ORDER_CONFLICT', 'ORDER_NOT_FOUND', 'IIKO_TIMEOUT', undefined]) assert.equal(SAFE_REJECTION_CODES.has(code), false);
  assert.equal(SAFE_REJECTION_CODES.has('PRICE_CHANGED'), true);
  assert.equal(SAFE_REJECTION_CODES.has('ITEM_UNAVAILABLE'), true);
  assert.throws(() => validateOrderResult({ id: 'other', status: 'accepted', items: [], total: 500 }, requestId));
  assert.throws(() => validateOrderResult({ id: requestId, status: 'unknown', items: [], total: 500 }, requestId));
});

test('repeated order transmission uses the same body and authorization and status lookup sends no contacts', async context => {
  const calls = [];
  context.mock.method(globalThis, 'fetch', async (path, options) => {
    calls.push({ path, options });
    return new Response(JSON.stringify({ id: requestId, status: 'processing', items: [], total: 500 }));
  });
  const body = { requestId, method: 'pickup', customer: { name: 'Тест', phone: '+79990000000' }, items: [{ id: 'food', quantity: 2 }], expectedTotal: 500 };
  await apiRequest('/api/orders', { method: 'POST', token, body });
  await apiRequest('/api/orders', { method: 'POST', token, body });
  await apiRequest(`/api/orders/${requestId}`, { token });
  assert.equal(calls[0].options.body, calls[1].options.body);
  assert.equal(calls[0].options.headers.Authorization, `Bearer ${token}`);
  assert.equal(calls[1].options.headers.Authorization, calls[0].options.headers.Authorization);
  assert.equal(calls[2].options.body, undefined);
  assert.equal(calls[2].path.includes(token), false);
  assert.equal(calls[2].options.headers.Authorization, `Bearer ${token}`);
});
