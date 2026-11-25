import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeCatalog } from './catalog.mjs';

const productId = '11111111-2222-3333-4444-555555555555';
const secondProductId = '11111111-2222-3333-4444-555555555556';
const sizeId = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
const placementId = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeef';
const modifierId = '99999999-bbbb-cccc-dddd-eeeeeeeeeeee';
const secondModifierId = '99999999-bbbb-cccc-dddd-eeeeeeeeeeef';
const modifierGroupId = '99999999-bbbb-cccc-dddd-eeeeeeeeeee0';
const modifierSchemaId = '99999999-bbbb-cccc-dddd-eeeeeeeeeee1';
const group = { id: 'test', name: 'Тест' };
const baseItem = { productId, name: 'Салат', sizePrices: [{ price: 100, menuItemSizeId: placementId }] };
const menu = item => ({ products: [{ id: productId, orderItemType: 'Product' }], itemsGroups: [{ ...group, items: [item] }] });
const limits = (minQuantity = 0, maxQuantity = 1, defaultQuantity = 0) => ({ minQuantity, maxQuantity, freeQuantity: 0, defaultQuantity });
function configuredMenu(type = 'Product') {
  const raw = menu({ ...baseItem, modifierGroups: [{
    name: 'Соусы', restrictions: limits(0, 2), childModifiersHaveMinMaxRestrictions: true,
    items: [{ id: modifierId }, { id: secondModifierId }],
  }] });
  raw.products[0] = { id: productId, orderItemType: type, modifierSchemaId };
  raw.modifiers = [
    { id: modifierId, name: 'Сацебели', restrictions: limits(), sizePrices: [{ price: 50 }] },
    { id: secondModifierId, name: 'Ткемали', restrictions: limits(), sizePrices: [{ price: 75.25 }] },
  ];
  return raw;
}

test('v3 catalogue preserves real product IDs and the server price in kopeks', () => {
  const raw = menu({ ...baseItem, description: 'Овощи', allergenGroupIds: ['milk'], sizePrices: [{ ...baseItem.sizePrices[0], price: 123.45, weight: 250, buttonImageUrl: 'https://images.example.test/salad.png' }] });
  raw.allergenGroups = [{ id: 'milk', name: 'Молоко' }];
  raw.credentials = { clientSecret: 'private-secret' };
  const result = normalizeCatalog(raw);
  assert.deepEqual(result.categories, [{ id: 'test', name: 'Тест' }]);
  assert.deepEqual(result.products, [{
    id: placementId, category: 'test', name: 'Салат', description: 'Овощи', price: 123.45,
    weight: '250 г', image: 'https://images.example.test/salad.png', allergens: 'Молоко',
    available: true, unavailableReason: '', source: 'iiko', modifierGroups: [],
  }]);
  assert.deepEqual(result.entries.get(placementId), { id: placementId, productId, name: 'Салат', price: 123.45, priceCents: 12345, orderItemType: 'Product', modifierGroups: [], available: true });
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

test('unknown modifier references and incomplete schemas fail closed', () => {
  for (const reference of [
    { modifierGroups: [{ items: [{ id: modifierId }] }] },
    { modifierGroups: { items: [{ id: modifierId }] } },
    { itemModifierGroups: [{ modifierId }] },
    { modifierIds: [modifierId] },
  ]) {
    const result = normalizeCatalog(menu({ ...baseItem, ...reference }));
    assert.equal(result.entries.get(placementId).available, false);
    assert.match(result.entries.get(placementId).unsupportedReason, /модификатор/);
  }
  const productReference = menu(baseItem);
  productReference.products[0].modifierSchemaId = modifierId;
  const withSchema = normalizeCatalog(productReference);
  assert.equal(withSchema.entries.get(placementId).available, false);
  assert.match(withSchema.products[0].unavailableReason, /модификатор/);
});

test('optional Compound choices retain prices and routing without exposing server metadata', () => {
  const raw = configuredMenu('Compound');
  const result = normalizeCatalog(raw);
  const entry = result.entries.get(placementId);
  assert.equal(entry.available, true);
  assert.equal(entry.orderItemType, 'Compound');
  assert.equal(entry.modifierSchemaId, modifierSchemaId);
  const group = entry.modifierGroups[0];
  assert.match(group.id, /^ungrouped:/);
  assert.equal(group.productGroupId, undefined);
  assert.equal(group.splittable, false);
  assert.equal(group.required, false);
  assert.deepEqual(group.items.map(item => [item.productId, item.priceCents]), [[modifierId, 5000], [secondModifierId, 7525]]);
  const publicGroup = result.products[0].modifierGroups[0];
  assert.equal(publicGroup.id, group.id);
  assert.equal(publicGroup.splittable, undefined);
  assert.equal(publicGroup.items[0].productId, undefined);
  assert.equal(publicGroup.items[0].available, true);
  raw.itemsGroups[0].items[0].modifierGroups[0].items.reverse();
  assert.equal(normalizeCatalog(raw).products[0].modifierGroups[0].id, group.id);
  assert.deepEqual(result.warnings, []);
});

test('required real modifier groups preserve explicit child overrides and inherited defaults', () => {
  const raw = configuredMenu();
  const group = raw.itemsGroups[0].items[0].modifierGroups[0];
  group.id = modifierGroupId;
  group.splittable = true;
  group.restrictions = limits(1, 2, 1);
  raw.modifiers[0].restrictions = limits(1, 2, 1);
  group.items[1] = { id: secondModifierId, name: 'Особый соус', restrictions: limits(0, 2) };
  const result = normalizeCatalog(raw);
  const entry = result.entries.get(placementId);
  assert.equal(entry.available, true);
  assert.equal(entry.modifierGroups[0].id, modifierGroupId);
  assert.equal(entry.modifierGroups[0].productGroupId, modifierGroupId);
  assert.equal(entry.modifierGroups[0].splittable, true);
  const publicGroup = result.products[0].modifierGroups[0];
  assert.equal(publicGroup.required, true);
  assert.equal(publicGroup.items[0].minQuantity, 1);
  assert.equal(publicGroup.items[0].defaultQuantity, 1);
  assert.equal(publicGroup.items[1].maxQuantity, 2);
  assert.equal(publicGroup.items[1].name, 'Особый соус');
});

test('group-only restrictions ignore child min and max but preserve defaults', () => {
  const raw = configuredMenu();
  const group = raw.itemsGroups[0].items[0].modifierGroups[0];
  group.childModifiersHaveMinMaxRestrictions = false;
  group.restrictions = limits(1, 2);
  raw.modifiers[0].restrictions = limits(3, 4, 1);
  const result = normalizeCatalog(raw);
  assert.equal(result.products[0].available, true);
  const option = result.products[0].modifierGroups[0].items[0];
  assert.equal(option.minQuantity, 0);
  assert.equal(option.maxQuantity, 2);
  assert.equal(option.defaultQuantity, 1);
});

test('modifier prices follow the actual product size and reject missing or ambiguous prices', () => {
  const raw = configuredMenu();
  raw.itemsGroups[0].items[0].sizePrices[0] = { ...baseItem.sizePrices[0], sizeId };
  raw.modifiers[0].sizePrices = [{ price: 50 }, { sizeId, price: 90.25 }];
  let result = normalizeCatalog(raw);
  assert.equal(result.products[0].available, true);
  assert.equal(result.products[0].modifierGroups[0].items[0].priceCents, 9025);
  assert.equal(result.products[0].modifierGroups[0].items[1].priceCents, 7525);
  for (const sizePrices of [[], [{ sizeId, price: null }], [{ sizeId, price: 20 }, { sizeId, price: 40 }], [{ price: 1.001 }]]) {
    raw.modifiers[0].sizePrices = sizePrices;
    result = normalizeCatalog(raw);
    assert.equal(result.products[0].available, false);
    assert.match(result.products[0].unavailableReason, /цену модификатора/);
  }
});

test('hidden optional choices disappear while hidden required or default choices block ordering', () => {
  const raw = configuredMenu();
  raw.modifiers[0].isHidden = true;
  let result = normalizeCatalog(raw);
  assert.equal(result.products[0].available, true);
  assert.deepEqual(result.products[0].modifierGroups[0].items.map(item => item.id), [secondModifierId]);
  for (const restrictions of [limits(1, 1), limits(0, 1, 1)]) {
    raw.modifiers[0].restrictions = restrictions;
    result = normalizeCatalog(raw);
    assert.equal(result.products[0].available, false);
    assert.match(result.products[0].unavailableReason, /скрыт/);
  }
});

test('unsupported free, independent, fractional and excessive modifier quantities fail closed', () => {
  const cases = [
    raw => { raw.modifiers[0].restrictions.freeQuantity = 1; },
    raw => { raw.itemsGroups[0].items[0].modifierGroups[0].restrictions.freeQuantity = 1; },
    raw => { raw.modifiers[0].independentQuantity = true; },
    raw => { raw.modifiers[0].restrictions.maxQuantity = 0.5; },
    raw => { raw.itemsGroups[0].items[0].modifierGroups[0].restrictions.maxQuantity = 101; },
    raw => { raw.modifiers[0].modifiers = [{ id: secondModifierId }]; },
  ];
  for (const modify of cases) {
    const raw = configuredMenu();
    modify(raw);
    const result = normalizeCatalog(raw);
    assert.equal(result.products[0].available, false);
    assert.match(result.products[0].unavailableReason, /модификатор/);
  }
});

test('impossible limits and duplicated option or group IDs cannot create ambiguous selections', () => {
  const cases = [
    group => { group.restrictions = limits(3, 3); },
    group => { group.items.push({ id: modifierId }); },
    group => { group.restrictions = limits(0, 1, 1); },
  ];
  for (const modify of cases) {
    const raw = configuredMenu();
    modify(raw.itemsGroups[0].items[0].modifierGroups[0]);
    assert.equal(normalizeCatalog(raw).products[0].available, false);
  }
  const raw = configuredMenu();
  raw.itemsGroups[0].items[0].modifierGroups.push(structuredClone(raw.itemsGroups[0].items[0].modifierGroups[0]));
  assert.equal(normalizeCatalog(raw).products[0].available, false);
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

test('incomplete Compound dishes and malformed sizes are visible but unavailable', () => {
  const raw = menu(baseItem);
  raw.products[0].orderItemType = 'Compound';
  const compound = normalizeCatalog(raw);
  assert.equal(compound.entries.get(placementId).available, false);
  assert.match(compound.products[0].unavailableReason, /составное/);
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

test('conflicting modifier configurations on a shared placement cannot be ordered', () => {
  const raw = configuredMenu();
  const duplicate = structuredClone(raw.itemsGroups[0].items[0]);
  duplicate.modifierGroups[0].items[0].restrictions = limits(0, 2);
  raw.itemsGroups[0].items.push(duplicate);
  const result = normalizeCatalog(raw);
  assert.equal(result.products.length, 1);
  assert.equal(result.products[0].available, false);
  assert.match(result.products[0].unavailableReason, /неоднозначны/);
});

test('invalid upstream menu containers fail with a safe response error', () => {
  for (const invalid of [null, [], 'private-menu', { itemsGroups: {} }]) {
    assert.throws(() => normalizeCatalog(invalid), { code: 'IIKO_RESPONSE' });
  }
});
