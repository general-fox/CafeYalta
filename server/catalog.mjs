import { IikoError } from './iiko-client.mjs';
import { createHash } from 'node:crypto';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const UNSUPPORTED_MODIFIERS = 'Не удалось проверить состав и ограничения модификаторов блюда.';
const COMPOUND_PRODUCT = 'Не удалось проверить составное блюдо для заказа на сайте.';
const INVALID_MODIFIER_PRICE = 'Не удалось проверить цену модификатора для выбранного размера блюда.';
const FREE_MODIFIERS = 'Для блюда настроены бесплатные количества модификаторов, которые пока не поддерживаются на сайте.';
const INDEPENDENT_MODIFIERS = 'Для блюда настроено независимое количество модификаторов, которое пока не поддерживается на сайте.';
const HIDDEN_MODIFIERS = 'Для блюда настроен скрытый обязательный модификатор или скрытый выбор по умолчанию.';
const INVALID_SIZE = 'Не удалось проверить размер блюда. Уточните возможность заказа в кафе.';
const AMBIGUOUS_ITEM = 'Данные блюда в меню неоднозначны. Уточните возможность заказа в кафе.';

const list = value => Array.isArray(value) ? value : [];
const text = (value, maximum = 2000) => typeof value === 'string'
  ? value.replace(/[\x00-\x1f\x7f-\x9f\u202a-\u202e\u2066-\u2069]/g, '').trim().slice(0, maximum)
  : '';
const positive = value => typeof value === 'number' && Number.isFinite(value) && value > 0;

function imageUrl(...values) {
  for (const value of values) {
    if (typeof value !== 'string') continue;
    try {
      const url = new URL(value);
      if (url.protocol === 'https:' && !url.username && !url.password) return url.href;
    } catch { /* An absent or invalid menu image is displayed as a placeholder. */ }
  }
  return '';
}

function money(value) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return null;
  const cents = Math.round(value * 100);
  // Do not silently turn missing prices into free items or accept sub-kopek
  // prices that the order total cannot represent exactly.
  if (!Number.isSafeInteger(cents) || (value > 0 && cents === 0) || Math.abs(value * 100 - cents) > 0.0001) return null;
  return { price: cents / 100, priceCents: cents };
}

function weightLabel(size, item) {
  const weight = typeof size.weight === 'number' ? size.weight : item.weight;
  if (!positive(weight)) return '';
  const unit = { GRAM: 'г', KILOGRAM: 'кг', MILLILITER: 'мл', LITER: 'л' }[size.measureUnitType ?? item.measureUnitType ?? 'GRAM'];
  return unit ? `${String(weight).replace('.', ',')} ${unit}` : '';
}

function hasUnknownModifierReferences(node, allowed = []) {
  if (!node || typeof node !== 'object') return false;
  return Object.entries(node).some(([key, value]) => {
    if (allowed.includes(key) || !/modifier/i.test(key) || value == null || value === false || value === '') return false;
    return !Array.isArray(value) || value.length > 0;
  });
}

function restrictions(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const result = {};
  for (const key of ['minQuantity', 'maxQuantity', 'freeQuantity', 'defaultQuantity']) {
    // These four fields have documented zero defaults in MenuV3.Restrictions.
    const amount = value[key] ?? 0;
    if (!Number.isSafeInteger(amount) || amount < 0 || amount > 100) return null;
    result[key] = amount;
  }
  if (result.minQuantity > result.maxQuantity || result.defaultQuantity > result.maxQuantity) return null;
  return result;
}

function modifierPrice(reference, sizeId) {
  const prices = list(reference.sizePrices).filter(price => price && typeof price === 'object');
  const matching = prices.filter(price => (price.sizeId || '') === (sizeId || ''));
  const candidates = matching.length ? matching : sizeId ? prices.filter(price => !price.sizeId) : [];
  return candidates.length === 1 ? money(candidates[0].price) : null;
}

function normalizeModifierGroups(item, size, reference, modifiers) {
  const fail = reason => ({ groups: [], reason });
  if (hasUnknownModifierReferences(item, ['modifierGroups']) || hasUnknownModifierReferences(size)
      || hasUnknownModifierReferences(reference, ['modifierSchemaId', 'modifierSchemaName'])) return fail(UNSUPPORTED_MODIFIERS);
  if (item.modifierGroups != null && !Array.isArray(item.modifierGroups)) return fail(UNSUPPORTED_MODIFIERS);
  if (reference?.modifierSchemaId && (!UUID.test(reference.modifierSchemaId) || !Array.isArray(item.modifierGroups))) return fail(UNSUPPORTED_MODIFIERS);

  const groups = [];
  const groupIds = new Set();
  for (const group of list(item.modifierGroups)) {
    if (!group || typeof group !== 'object' || !Array.isArray(group.items)) return fail(UNSUPPORTED_MODIFIERS);
    if (hasUnknownModifierReferences(group, ['childModifiersHaveMinMaxRestrictions'])) return fail(UNSUPPORTED_MODIFIERS);
    const groupLimits = restrictions(group.restrictions);
    if (!groupLimits) return fail(UNSUPPORTED_MODIFIERS);
    if (groupLimits.freeQuantity > 0) return fail(FREE_MODIFIERS);
    const productGroupId = text(group.id, 100);
    if (productGroupId && !UUID.test(productGroupId)) return fail(UNSUPPORTED_MODIFIERS);
    if (group.childModifiersHaveMinMaxRestrictions != null && typeof group.childModifiersHaveMinMaxRestrictions !== 'boolean') return fail(UNSUPPORTED_MODIFIERS);
    if (group.splittable != null && typeof group.splittable !== 'boolean') return fail(UNSUPPORTED_MODIFIERS);
    const childLimitsEnabled = group.childModifiersHaveMinMaxRestrictions === true;
    const items = [];
    const itemIds = new Set();
    for (const child of group.items) {
      const productId = text(child?.id, 100);
      const modifier = modifiers.get(productId);
      if (!UUID.test(productId) || !modifier || itemIds.has(productId)) return fail(UNSUPPORTED_MODIFIERS);
      if (hasUnknownModifierReferences(child) || hasUnknownModifierReferences(modifier)) return fail(UNSUPPORTED_MODIFIERS);
      if (modifier.independentQuantity != null && typeof modifier.independentQuantity !== 'boolean') return fail(UNSUPPORTED_MODIFIERS);
      itemIds.add(productId);
      const childLimits = restrictions(child.restrictions ?? modifier.restrictions);
      if (!childLimits) return fail(UNSUPPORTED_MODIFIERS);
      const limits = childLimitsEnabled ? childLimits : { ...childLimits, minQuantity: 0, maxQuantity: groupLimits.maxQuantity };
      if (limits.defaultQuantity > limits.maxQuantity) return fail(UNSUPPORTED_MODIFIERS);
      const hidden = group.isHidden === true || group.isDeleted === true || (child.isHidden ?? modifier.isHidden) === true || child.isDeleted === true || modifier.isDeleted === true;
      if (hidden) {
        if (limits.minQuantity > 0 || limits.defaultQuantity > 0) return fail(HIDDEN_MODIFIERS);
        continue;
      }
      if (limits.freeQuantity > 0) return fail(FREE_MODIFIERS);
      if (modifier.independentQuantity === true || child.independentQuantity === true) return fail(INDEPENDENT_MODIFIERS);
      const amounts = modifierPrice(modifier, size.sizeId);
      if (!amounts) return fail(INVALID_MODIFIER_PRICE);
      const name = text(child.name ?? modifier.name, 150);
      if (!name) return fail(UNSUPPORTED_MODIFIERS);
      items.push({ id: productId, productId, name, ...amounts, ...limits, available: true });
    }
    if (group.isHidden || group.isDeleted) {
      if (groupLimits.minQuantity > 0 || groupLimits.defaultQuantity > 0) return fail(HIDDEN_MODIFIERS);
      continue;
    }
    const sumMin = items.reduce((sum, child) => sum + child.minQuantity, 0);
    const sumMax = items.reduce((sum, child) => sum + child.maxQuantity, 0);
    const sumDefault = items.reduce((sum, child) => sum + child.defaultQuantity, 0);
    if (sumMin > groupLimits.maxQuantity || sumMax < groupLimits.minQuantity || sumDefault > groupLimits.maxQuantity
        || (groupLimits.defaultQuantity > 0 && sumDefault !== groupLimits.defaultQuantity)) return fail(UNSUPPORTED_MODIFIERS);
    if (!items.length) continue;
    // MenuV3 represents independent (non-group) modifiers in a virtual group
    // with no ID. Keep its public selection key stable when menu order changes;
    // never send this synthetic key as an iiko productGroupId.
    const id = productGroupId || `ungrouped:${createHash('sha256').update([...itemIds].sort().join('|')).digest('hex').slice(0, 24)}`;
    if (groupIds.has(id)) return fail(UNSUPPORTED_MODIFIERS);
    groupIds.add(id);
    groups.push({ id, name: text(group.name, 150) || 'Дополнительно', ...groupLimits,
      required: groupLimits.minQuantity > 0, ...(productGroupId ? { productGroupId } : {}),
      splittable: group.splittable === true, items });
  }
  return { groups, reason: '' };
}

function publicModifierGroups(groups) {
  return groups.map(({ productGroupId, splittable, items, ...group }) => ({
    ...group, items: items.map(({ productId, ...item }) => item),
  }));
}

/** Convert only the public catalogue fields and retain order IDs server-side. */
export function normalizeCatalog(rawV3) {
  if (!rawV3 || typeof rawV3 !== 'object' || Array.isArray(rawV3)) throw new IikoError('IIKO_RESPONSE');
  if (rawV3.itemsGroups != null && !Array.isArray(rawV3.itemsGroups)) throw new IikoError('IIKO_RESPONSE');

  const categories = [];
  const products = [];
  const entries = new Map();
  const warnings = new Set();
  const categoryIds = new Set();
  const publicProducts = new Map();
  const references = new Map(list(rawV3.products).map(product => [product?.id, product]));
  const modifiers = new Map(list(rawV3.modifiers).map(modifier => [modifier?.id, modifier]));
  const allergens = new Map(list(rawV3.allergenGroups).filter(allergen => allergen && !allergen.isDeleted)
    .map(allergen => [allergen.id, text(allergen.name, 150)]));

  for (const [groupIndex, group] of list(rawV3.itemsGroups).entries()) {
    if (!group || typeof group !== 'object' || group.isHidden || group.isDeleted) continue;
    const category = text(group.id, 150) || `iiko-group-${groupIndex + 1}`;
    if (!categoryIds.has(category)) {
      categories.push({ id: category, name: text(group.name, 150) || 'Меню' });
      categoryIds.add(category);
    }

    for (const item of list(group.items)) {
      if (!item || typeof item !== 'object' || item.isHidden || item.isDeleted) continue;
      const productId = text(item.productId, 100);
      const reference = references.get(productId);
      if (reference?.isDeleted) continue;
      const name = text(item.name, 150) || text(reference?.name, 150);
      if (!UUID.test(productId) || !name) {
        warnings.add('В меню пропущена позиция без корректного идентификатора блюда или названия.');
        continue;
      }
      const visibleSizes = list(item.sizePrices).filter(size => size && typeof size === 'object' && !size.isHidden && !size.isDeleted);
      if (visibleSizes.length === 0) warnings.add(`${name}: отсутствует цена для заказа.`);

      for (const size of visibleSizes) {
        const amounts = money(size.price);
        if (!amounts) {
          warnings.add(`${name}: позиция пропущена из-за некорректной цены.`);
          continue;
        }
        const sizeId = text(size.sizeId, 100);
        const sizeKey = text(size.menuItemSizeId, 100);
        const id = UUID.test(sizeKey) ? sizeKey : `${productId}:${sizeId || 'default'}`;
        const sizeName = text(size.sizeName ?? size.sizeCode, 80);
        const displayName = sizeName ? `${name} · ${sizeName}` : name;
        let unsupportedReason;
        const orderItemType = item.orderItemType ?? reference?.orderItemType ?? 'Product';
        const modifierSchemaId = text(reference?.modifierSchemaId, 100);
        const modifierData = normalizeModifierGroups(item, size, reference, modifiers);
        if (!['Product', 'Compound'].includes(orderItemType)
            || (orderItemType === 'Compound' && (!UUID.test(modifierSchemaId) || !Array.isArray(item.modifierGroups)))) unsupportedReason = COMPOUND_PRODUCT;
        else if ((sizeId && !UUID.test(sizeId)) || (visibleSizes.length > 1 && !UUID.test(sizeId))) unsupportedReason = INVALID_SIZE;
        else if (modifierData.reason) unsupportedReason = modifierData.reason;

        const entry = {
          id, productId, ...(sizeId ? { sizeId } : {}), name: displayName, ...amounts, orderItemType,
          ...(modifierSchemaId ? { modifierSchemaId } : {}), modifierGroups: modifierData.groups,
          available: !unsupportedReason, ...(unsupportedReason ? { unsupportedReason } : {}),
        };
        const previous = entries.get(id);
        if (previous) {
          if (previous.productId !== productId || previous.sizeId !== entry.sizeId || previous.priceCents !== entry.priceCents || previous.available !== entry.available
              || previous.orderItemType !== entry.orderItemType || previous.modifierSchemaId !== entry.modifierSchemaId
              || JSON.stringify(previous.modifierGroups) !== JSON.stringify(entry.modifierGroups)) {
            previous.available = false;
            previous.unsupportedReason = AMBIGUOUS_ITEM;
            const previousProduct = publicProducts.get(id);
            previousProduct.available = false;
            previousProduct.unavailableReason = AMBIGUOUS_ITEM;
            warnings.add(`${displayName}: повторяющийся идентификатор с различающимися данными.`);
          }
          continue;
        }

        const allergenNames = [...new Set([...list(item.allergenGroupIds), ...list(size.allergenGroupIds)]
          .map(allergenId => allergens.get(allergenId)).filter(Boolean))];
        const product = {
          id, category, name: displayName, description: text(item.description ?? reference?.description),
          price: amounts.price, weight: weightLabel(size, item),
          image: imageUrl(size.buttonImageUrl, item.buttonImageUrl, reference?.buttonImageUrl),
          allergens: allergenNames.join(', '), available: entry.available,
          unavailableReason: unsupportedReason || '', source: 'iiko', modifierGroups: publicModifierGroups(modifierData.groups),
        };
        entries.set(id, entry);
        publicProducts.set(id, product);
        products.push(product);
        if (unsupportedReason) warnings.add(`${displayName}: ${unsupportedReason}`);
      }
    }
  }

  return { categories, products, entries, warnings: [...warnings] };
}
