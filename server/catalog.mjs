import { IikoError } from './iiko-client.mjs';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const REQUIRED_MODIFIERS = 'Для блюда требуется выбор модификаторов, который пока не поддерживается на сайте.';
const UNSUPPORTED_MODIFIERS = 'Для блюда настроены модификаторы. Их выбор пока не поддерживается на сайте.';
const COMPOUND_PRODUCT = 'Составное блюдо пока недоступно для заказа на сайте.';
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

function hasRequiredModifiers(node, references) {
  if (!node || typeof node !== 'object') return false;
  const reference = references.get(node.id);
  const restrictions = node.restrictions ?? reference?.restrictions;
  if (node.required === true || reference?.required === true || positive(node.minAmount) || positive(restrictions?.minQuantity)) return true;
  // A configured default also needs explicit handling before this stage can
  // safely order the dish with the composition shown by the restaurant.
  if (positive(node.defaultAmount) || positive(restrictions?.defaultQuantity)) return true;
  return ['modifierGroups', 'groupModifiers', 'modifiers', 'items', 'childModifiers'].some(key =>
    list(node[key]).some(child => hasRequiredModifiers(child, references)));
}

function hasModifierReferences(node) {
  if (!node || typeof node !== 'object') return false;
  // v3 uses item.modifierGroups[].items[] -> MenuV3.modifiers. Older or
  // unfamiliar modifier references must also fail closed: this stage has no
  // selection UI and cannot preserve even optional/default compositions.
  return Object.entries(node).some(([key, value]) => {
    if (!/modifier/i.test(key) || value == null || value === false || value === '') return false;
    return !Array.isArray(value) || value.length > 0;
  });
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
        const orderItemType = item.orderItemType ?? reference?.orderItemType;
        if (orderItemType && orderItemType !== 'Product') unsupportedReason = COMPOUND_PRODUCT;
        else if (hasRequiredModifiers(item, modifiers) || hasRequiredModifiers(size, modifiers) || hasRequiredModifiers(reference, modifiers)) unsupportedReason = REQUIRED_MODIFIERS;
        else if (hasModifierReferences(item) || hasModifierReferences(size) || hasModifierReferences(reference)) unsupportedReason = UNSUPPORTED_MODIFIERS;
        else if ((sizeId && !UUID.test(sizeId)) || (visibleSizes.length > 1 && !UUID.test(sizeId))) unsupportedReason = INVALID_SIZE;

        const entry = {
          id, productId, ...(sizeId ? { sizeId } : {}), name: displayName, ...amounts,
          available: !unsupportedReason, ...(unsupportedReason ? { unsupportedReason } : {}),
        };
        const previous = entries.get(id);
        if (previous) {
          if (previous.productId !== productId || previous.sizeId !== entry.sizeId || previous.priceCents !== entry.priceCents || previous.available !== entry.available) {
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
          unavailableReason: unsupportedReason || '', source: 'iiko',
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
