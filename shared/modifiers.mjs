// This module is shared by the storefront and the order service. Prices and
// restrictions must come from the current normalized catalogue, never a cart.
const MAX_SELECTIONS = 100;
const MAX_AMOUNT = 100;
const MAX_TOTAL_CENTS = 100_000_000;
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const identifier = value => typeof value === 'string' && value.length > 0 && value.length <= 200;
const amount = value => Number.isInteger(value) && value >= 0 && value <= MAX_AMOUNT;

function money(value, declared) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return null;
  const result = Math.round(value * 100);
  if (!Number.isSafeInteger(result) || result > MAX_TOTAL_CENTS || Math.abs(value * 100 - result) > 0.00001) return null;
  return declared == null || declared === result ? result : null;
}

export function canonicalModifierSelection(value = []) {
  if (!Array.isArray(value) || value.length > MAX_SELECTIONS) throw new TypeError('Некорректный выбор добавок.');
  const seen = new Set();
  const selections = value.map(selection => {
    if (!object(selection) || !identifier(selection.groupId) || !identifier(selection.modifierId)
      || !amount(selection.quantity) || selection.quantity === 0) throw new TypeError('Некорректный выбор добавок.');
    const key = JSON.stringify([selection.groupId, selection.modifierId]);
    if (seen.has(key)) throw new TypeError('Одна добавка выбрана несколько раз.');
    seen.add(key);
    return { groupId: selection.groupId, modifierId: selection.modifierId, quantity: selection.quantity };
  });
  return selections.sort((a, b) => a.groupId.localeCompare(b.groupId) || a.modifierId.localeCompare(b.modifierId));
}

export function cartLineId(id, selections = []) {
  const canonical = canonicalModifierSelection(selections);
  // Keep the full selection instead of a short hash: distinct choices cannot
  // collide, and legacy items without choices retain their existing identity.
  return canonical.length ? `${id}::${encodeURIComponent(JSON.stringify(canonical))}` : id;
}

export function defaultModifierSelection(product) {
  const selected = [];
  for (const group of Array.isArray(product?.modifierGroups) ? product.modifierGroups : []) {
    for (const item of Array.isArray(group?.items) ? group.items : []) {
      if (item.available !== false && amount(item.defaultQuantity) && item.defaultQuantity > 0) {
        selected.push({ groupId: group.id, modifierId: item.id, quantity: item.defaultQuantity });
      }
    }
  }
  try { return canonicalModifierSelection(selected); } catch { return []; }
}

export function evaluateModifierSelection(product, supplied = []) {
  const errors = [];
  let selections = [];
  try { selections = canonicalModifierSelection(supplied); }
  catch (error) { errors.push(error.message); }
  const basePriceCents = money(product?.basePrice ?? product?.price, product?.basePrice != null ? undefined : product?.priceCents);
  if (basePriceCents === null) errors.push('Не удалось проверить цену блюда.');
  const groups = product?.modifierGroups ?? [];
  if (!Array.isArray(groups)) errors.push('Не удалось проверить состав блюда.');
  const groupMap = new Map();
  const selectedModifiers = [];
  let total = basePriceCents ?? 0;

  for (const group of Array.isArray(groups) ? groups : []) {
    if (!object(group) || !identifier(group.id) || groupMap.has(group.id) || !Array.isArray(group.items)
      || !amount(group.minQuantity) || !amount(group.maxQuantity) || group.minQuantity > group.maxQuantity
      || (group.freeQuantity ?? 0) !== 0) {
      errors.push('Не удалось проверить ограничения добавок.');
      continue;
    }
    const itemMap = new Map();
    groupMap.set(group.id, { group, itemMap });
    for (const item of group.items) {
      const priceCents = money(item?.price, item?.priceCents);
      if (!object(item) || !identifier(item.id) || itemMap.has(item.id) || !amount(item.minQuantity)
        || !amount(item.maxQuantity) || item.minQuantity > item.maxQuantity || !amount(item.defaultQuantity)
        || item.defaultQuantity > item.maxQuantity || (item.freeQuantity ?? 0) !== 0 || priceCents === null) {
        errors.push('Не удалось проверить параметры добавки.');
        continue;
      }
      itemMap.set(item.id, { item, priceCents });
    }
  }

  for (const selection of selections) {
    const found = groupMap.get(selection.groupId)?.itemMap.get(selection.modifierId);
    if (!found || found.item.available === false) {
      errors.push('Выбранная добавка больше недоступна. Откройте блюдо заново.');
      continue;
    }
    const { item, priceCents } = found;
    selectedModifiers.push({ ...selection, name: String(item.name || 'Добавка').slice(0, 200), price: priceCents / 100, priceCents });
    total += priceCents * selection.quantity;
  }

  for (const { group, itemMap } of groupMap.values()) {
    const groupSelections = selections.filter(selection => selection.groupId === group.id);
    const count = groupSelections.reduce((sum, selection) => sum + selection.quantity, 0);
    if (count < group.minQuantity || count > group.maxQuantity) {
      errors.push(`${group.name || 'Добавки'}: выберите от ${group.minQuantity} до ${group.maxQuantity}.`);
    }
    for (const { item } of itemMap.values()) {
      const quantity = groupSelections.find(selection => selection.modifierId === item.id)?.quantity || 0;
      if (quantity < item.minQuantity || quantity > item.maxQuantity) {
        errors.push(`${item.name || 'Добавка'}: допустимо от ${item.minQuantity} до ${item.maxQuantity}.`);
      }
    }
  }
  if (!Number.isSafeInteger(total) || total > MAX_TOTAL_CENTS) errors.push('Сумма заказа слишком велика.');
  return { valid: errors.length === 0, unitPrice: total / 100, unitPriceCents: total, errors: [...new Set(errors)], selectedModifiers, selections };
}
