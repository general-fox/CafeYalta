import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeCatalog } from './catalog.mjs';

const productId = '11111111-2222-3333-4444-555555555555';
const secondProductId = '11111111-2222-3333-4444-555555555556';
const sizeId = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
const placementId = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeef';
const modifierId = '99999999-bbbb-cccc-dddd-eeeeeeeeeeee';
const group = { id: 'test', name: 'Тест' };
const baseItem = { productId, name: 'Салат', sizePrices: [{ price: 100, menuItemSizeId: placementId }] };
const menu = item => ({ products: [{ id: productId, orderItemType: 'Product' }], itemsGroups: [{ ...group, items: [item] }] });

test('v3 catalogue preserves real product IDs and the server price in kopeks', () => {
  const raw = menu({ ...baseItem, description: 'Овощи', allergenGroupIds: ['milk'], sizePrices: [{ ...baseItem.sizePrices[0], price: 123.45, weight: 250, buttonImageUrl: 'https://images.example.test/salad.png' }] });
  raw.allergenGroups = [{ id: 'milk', name: 'Молоко' }];
  raw.credentials = { clientSecret: 'private-secret' };
  const result = normalizeCatalog(raw);
  assert.deepEqual(result.categories, [{ id: 'test', name: 'Тест' }]);
  assert.deepEqual(result.products, [{
    id: placementId, category: 'test', name: 'Салат', description: 'Овощи', price: 123.45,
    weight: '250 г', image: 'https://images.example.test/salad.png', allergens: 'Молоко',
    available: true, unavailableReason: '', source: 'iiko',
  }]);
  assert.deepEqual(result.entries.get(placementId), { id: placementId, productId, name: 'Салат', price: 123.45, priceCents: 12345, available: true });
  assert.ok(!JSON.stringify(result.products).includes('private-secret'));
  assert.equal(result.entries.get(placementId).sizeId, undefined);
  assert.deepEqual(result.warnings, []);
});

test('zero prices remain valid and missing or malformed prices never become free products', () => {
  const raw = menu(baseItem);
  raw.itemsGroups[0].items = [0, null, -1, '100', 1.001, Infinity, 0.0000001]
    .map(price => ({ ...baseItem, sizePrices: [{ price }] }));
  const result = normalizeCatalog(raw);
  assert.equal(result.products.length, 1);
  const entry = result.entries.get(`${productId}:default`);
  assert.equal(entry.priceCents, 0);
  assert.equal(entry.price, 0);
  assert.equal(entry.available, true);
  assert.ok(result.warnings.length > 0);
});

test('size ID is distinct from the public placement ID and all simple sizes are retained', () => {
  const result = normalizeCatalog(menu({ ...baseItem, sizePrices: [
    { menuItemSizeId: placementId, sizeId, sizeName: 'Большой', price: 200, weight: 0.5, measureUnitType: 'KILOGRAM' },
    { menuItemSizeId: 'not-a-uuid', price: 100 },
  ] }));
  assert.equal(result.products[0].name, 'Салат · Большой');
  assert.equal(result.products[0].weight, '0,5 кг');
  assert.equal(result.entries.get(placementId).sizeId, sizeId);
  assert.ok(result.entries.has(`${productId}:default`));
  assert.notEqual(result.entries.get(placementId).productId, placementId);
});

test('mandatory modifiers and inherited minimum quantities cannot be silently omitted', () => {
  for (const modifierData of [
    { modifierGroups: [{ restrictions: { minQuantity: 1 }, items: [] }] },
    { modifiers: [{ id: modifierId, required: true }] },
    { modifierGroups: [{ items: [{ id: modifierId }] }] },
    { groupModifiers: [{ minAmount: 1, childModifiers: [] }] },
  ]) {
    const raw = menu({ ...baseItem, ...modifierData });
    raw.modifiers = [{ id: modifierId, restrictions: { minQuantity: 1 } }];
    const result = normalizeCatalog(raw);
    assert.equal(result.entries.get(placementId).available, false);
    assert.match(result.entries.get(placementId).unsupportedReason, /модификаторов/);
    assert.equal(result.products[0].available, false);
    assert.match(result.products[0].unavailableReason, /модификаторов/);
  }
});

test('optional and unknown modifier references fail closed until selection is supported', () => {
  const optional = normalizeCatalog(menu({ ...baseItem, modifierGroups: [{ restrictions: { minQuantity: 0 }, items: [{ id: modifierId, restrictions: { minQuantity: 0, defaultQuantity: 0 } }] }] }));
  assert.equal(optional.entries.get(placementId).available, false);
  assert.match(optional.entries.get(placementId).unsupportedReason, /модификаторы/);
  const defaulted = normalizeCatalog(menu({ ...baseItem, modifierGroups: [{ items: [{ id: modifierId, restrictions: { defaultQuantity: 1 } }] }] }));
  assert.equal(defaulted.entries.get(placementId).available, false);
  for (const reference of [
    { modifierGroups: [{ items: [{ id: modifierId }] }] },
    { modifierGroups: { items: [{ id: modifierId }] } },
    { itemModifierGroups: [{ modifierId }] },
    { modifierIds: [modifierId] },
  ]) {
    const result = normalizeCatalog(menu({ ...baseItem, ...reference }));
    assert.equal(result.entries.get(placementId).available, false);
    assert.match(result.entries.get(placementId).unsupportedReason, /модификаторы/);
  }
  const productReference = menu(baseItem);
  productReference.products[0].modifierSchemaId = modifierId;
  const withSchema = normalizeCatalog(productReference);
  assert.equal(withSchema.entries.get(placementId).available, false);
  assert.match(withSchema.products[0].unavailableReason, /модификаторы/);
});

test('multiple size variants without real iiko size IDs cannot be ordered by placement IDs', () => {
  const secondPlacementId = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeef0';
  const result = normalizeCatalog(menu({ ...baseItem, sizePrices: [
    { menuItemSizeId: placementId, sizeName: 'Маленький', price: 100 },
    { menuItemSizeId: secondPlacementId, sizeName: 'Большой', price: 200 },
  ] }));
  assert.deepEqual(result.products.map(product => product.name), ['Салат · Маленький', 'Салат · Большой']);
  for (const entry of result.entries.values()) {
    assert.equal(entry.available, false);
    assert.equal(entry.sizeId, undefined);
    assert.match(entry.unsupportedReason, /размер/);
  }
});

test('compound dishes and malformed sizes are visible but unavailable', () => {
  const raw = menu(baseItem);
  raw.products[0].orderItemType = 'Compound';
  const compound = normalizeCatalog(raw);
  assert.equal(compound.entries.get(placementId).available, false);
  assert.match(compound.products[0].unavailableReason, /Составное/);
  const invalidSize = normalizeCatalog(menu({ ...baseItem, sizePrices: [{ price: 100, sizeId: 'bad-size', menuItemSizeId: placementId }] }));
  assert.equal(invalidSize.entries.get(placementId).available, false);
  assert.match(invalidSize.products[0].unavailableReason, /размер/);
});

test('hidden and deleted items are excluded and malformed product IDs cannot enter an order', () => {
  const raw = menu(baseItem);
  raw.itemsGroups.push({ id: 'hidden', name: 'Скрыто', isHidden: true, items: [baseItem] });
  raw.itemsGroups[0].items = [
    { ...baseItem, isHidden: true }, { ...baseItem, isDeleted: true },
    { ...baseItem, productId: 'demo-product' },
    { ...baseItem, sizePrices: [{ price: 100, isHidden: true }] },
  ];
  const result = normalizeCatalog(raw);
  assert.deepEqual(result.products, []);
  assert.equal(result.entries.size, 0);
  assert.equal(result.categories.length, 1);
});

test('public image URLs allow HTTPS only and reject embedded credentials', () => {
  for (const url of ['http://images.example.test/a.png', 'javascript:alert(1)', 'data:image/png;base64,AAAA', 'https://user:secret@images.example.test/a.png', '/private.png']) {
    const result = normalizeCatalog(menu({ ...baseItem, sizePrices: [{ price: 100, buttonImageUrl: url }] }));
    assert.equal(result.products[0].image, '');
  }
});

test('conflicting duplicate placement IDs are unavailable instead of selecting an arbitrary price', () => {
  const raw = menu(baseItem);
  raw.products.push({ id: secondProductId, orderItemType: 'Product' });
  raw.itemsGroups[0].items.push({ ...baseItem, productId: secondProductId, sizePrices: [{ price: 200, menuItemSizeId: placementId }] });
  const result = normalizeCatalog(raw);
  assert.equal(result.products.length, 1);
  assert.equal(result.entries.get(placementId).available, false);
  assert.match(result.products[0].unavailableReason, /неоднозначны/);
});

test('invalid upstream menu containers fail with a safe response error', () => {
  for (const invalid of [null, [], 'private-menu', { itemsGroups: {} }]) {
    assert.throws(() => normalizeCatalog(invalid), { code: 'IIKO_RESPONSE' });
  }
});
