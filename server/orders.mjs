import { createHash, timingSafeEqual } from 'node:crypto';
import { createFileOrderStore } from './order-store.mjs';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CAPABILITY = /^(?:[0-9a-f]{32,128}|[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/i;
const MAX_TOTAL_CENTS = 100_000_000;
const messages = {
  INVALID_ORDER: 'Проверьте имя, телефон и состав заказа. Доступен только самовывоз.',
  ORDER_NOT_FOUND: 'Заявка не найдена.',
  REQUEST_CONFLICT: 'Эта заявка уже отправлялась с другим составом или данными. Сначала проверьте её статус.',
  PRICE_CHANGED: 'Цена заказа изменилась. Обновите меню и проверьте корзину.',
  ITEM_UNAVAILABLE: 'В корзине есть недоступное блюдо или блюдо, требующее выбора модификаторов.',
  ORDERING_DISABLED: 'Отправка заказов пока отключена.',
  CATALOG_UNAVAILABLE: 'Не удалось проверить актуальное меню. Повторите позже.',
  POS_UNAVAILABLE: 'Касса сейчас недоступна. Попробуйте позже.',
  PICKUP_UNAVAILABLE: 'В iiko не настроен доступный тип заказа на самовывоз.',
  CASH_PAYMENT_UNAVAILABLE: 'В iiko не настроена оплата наличными при получении для этой кассы.',
  IIKO_UNAVAILABLE: 'Не удалось проверить настройки iiko. Заявка ещё не отправлялась.',
  ORDER_STORAGE_UNAVAILABLE: 'Не удалось прочитать или сохранить заявку. Не оформляйте её повторно, пока статус не проверен.',
};

export class OrderError extends Error {
  constructor(code = 'INVALID_ORDER', { status = 400 } = {}) {
    const safeCode = Object.hasOwn(messages, code) ? code : 'INVALID_ORDER';
    super(messages[safeCode]);
    this.name = 'OrderError';
    this.code = safeCode;
    this.status = status;
  }
}

const fail = (code, status = 400) => { throw new OrderError(code, { status }); };
const hash = value => createHash('sha256').update(value).digest('hex');
const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const sameId = (a, b) => typeof a === 'string' && typeof b === 'string' && a.toLowerCase() === b.toLowerCase();

function requestId(value) {
  if (typeof value !== 'string' || !UUID.test(value)) fail('INVALID_ORDER');
  return value.toLowerCase();
}

function tokenHash(token) {
  if (typeof token !== 'string' || !CAPABILITY.test(token)) fail('ORDER_NOT_FOUND', 404);
  return hash(token);
}

function authorized(record, accessTokenHash) {
  if (!record || typeof record.accessTokenHash !== 'string' || !/^[0-9a-f]{64}$/.test(record.accessTokenHash)) return false;
  return timingSafeEqual(Buffer.from(record.accessTokenHash, 'hex'), Buffer.from(accessTokenHash, 'hex'));
}

function cents(value) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return null;
  const result = Math.round(value * 100);
  return Number.isSafeInteger(result) && result <= MAX_TOTAL_CENTS && Math.abs(value * 100 - result) < 0.00001 ? result : null;
}

function text(value, maximum, { required = false } = {}) {
  if (value == null && !required) return '';
  if (typeof value !== 'string') fail('INVALID_ORDER');
  const clean = value.trim();
  if ((required && !clean) || clean.length > maximum || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(clean)) fail('INVALID_ORDER');
  return clean;
}

function validatePayload(payload) {
  if (!isObject(payload) || payload.method !== 'pickup' || !isObject(payload.customer)) fail('INVALID_ORDER');
  const name = text(payload.customer.name, 80, { required: true });
  const suppliedPhone = text(payload.customer.phone, 40, { required: true });
  if (!/^[+\d ()-]+$/.test(suppliedPhone)) fail('INVALID_ORDER');
  let digits = suppliedPhone.replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('8')) digits = `7${digits.slice(1)}`;
  if (digits.length === 10 && !suppliedPhone.startsWith('+')) digits = `7${digits}`;
  const phone = `+${digits}`;
  if (!/^\+[1-9]\d{7,14}$/.test(phone)) fail('INVALID_ORDER');
  const comment = text(payload.comment, 500);
  const expectedTotalCents = cents(payload.expectedTotal);
  if (expectedTotalCents === null || !Array.isArray(payload.items) || !payload.items.length || payload.items.length > 30) fail('INVALID_ORDER');
  const quantities = new Map();
  for (const item of payload.items) {
    if (!isObject(item) || typeof item.id !== 'string' || !item.id || item.id.length > 200 || !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 30) fail('INVALID_ORDER');
    const quantity = (quantities.get(item.id) || 0) + item.quantity;
    if (quantity > 30) fail('INVALID_ORDER');
    quantities.set(item.id, quantity);
  }
  const items = [...quantities].sort(([a], [b]) => a.localeCompare(b)).map(([id, quantity]) => ({ id, quantity }));
  return { method: 'pickup', customer: { name, phone }, comment, items, expectedTotalCents };
}

function publicOrder(record) {
  return {
    id: record.id,
    status: record.status,
    total: record.totalCents / 100,
    items: record.items.map(({ id, name, priceCents, quantity }) => ({ id, name, price: priceCents / 100, quantity })),
    createdAt: record.createdAt,
    message: record.status === 'accepted' ? 'Заказ поступил в iikoFront. Оплата наличными при получении.'
      : record.status === 'failed' ? 'iiko не приняла заказ. Проверьте заявку перед новым оформлением.'
        : 'Проверяем поступление заказа в iikoFront. Не оформляйте его повторно.',
    ...(Number.isSafeInteger(record.number) && record.number >= 0 ? { number: record.number } : {}),
  };
}

function selectedOrderType(result, organizationId) {
  if (!Array.isArray(result?.orderTypes)) fail('IIKO_UNAVAILABLE', 502);
  const candidates = result.orderTypes.filter(group => sameId(group?.organizationId, organizationId))
    .flatMap(group => Array.isArray(group.items) ? group.items : [])
    .filter(type => UUID.test(type?.id || '') && type.orderServiceType === 'DeliveryPickUp' && type.isDeleted !== true);
  candidates.sort((a, b) => Number(b.isDefault === true) - Number(a.isDefault === true) || a.id.localeCompare(b.id));
  if (!candidates.length) fail('PICKUP_UNAVAILABLE', 503);
  return candidates[0];
}

function selectedCashPayment(result, terminalGroupId) {
  if (!Array.isArray(result?.paymentTypes)) fail('IIKO_UNAVAILABLE', 502);
  const candidates = result.paymentTypes.filter(type => UUID.test(type?.id || '') && type.paymentTypeKind === 'Cash' && type.isDeleted !== true
    && type.paymentProcessingType !== 'External' && Array.isArray(type.terminalGroups)
    && type.terminalGroups.some(group => sameId(group?.id, terminalGroupId)));
  candidates.sort((a, b) => a.id.localeCompare(b.id));
  if (!candidates.length) fail('CASH_PAYMENT_UNAVAILABLE', 503);
  return candidates[0];
}

function snapshotItems(validated, catalog) {
  if (!(catalog?.entries instanceof Map)) fail('CATALOG_UNAVAILABLE', 503);
  return validated.items.map(({ id, quantity }) => {
    const entry = catalog.entries.get(id);
    if (!entry || entry.available !== true || entry.requiresModifiers || entry.requiredModifiers || entry.hasRequiredModifiers) fail('ITEM_UNAVAILABLE', 409);
    if (!UUID.test(entry.productId || '') || (entry.sizeId != null && !UUID.test(entry.sizeId))) fail('ITEM_UNAVAILABLE', 409);
    const priceCents = entry.priceCents;
    if (!Number.isSafeInteger(priceCents) || priceCents < 0 || priceCents > MAX_TOTAL_CENTS || cents(entry.price) !== priceCents) fail('CATALOG_UNAVAILABLE', 503);
    return { id, productId: entry.productId, ...(entry.sizeId ? { sizeId: entry.sizeId } : {}), name: String(entry.name || 'Блюдо').slice(0, 200), priceCents, quantity };
  });
}

function iikoItems(items) {
  return items.map(item => ({ type: 'Product', productId: item.productId, amount: item.quantity, price: item.priceCents / 100,
    ...(item.sizeId ? { productSizeId: item.sizeId } : {}) }));
}

// Status reads use IDs from our persisted record, never arbitrary
// customer-supplied iiko IDs or a phone-number history lookup.
export function createOrderService({ config, client, getCatalog, store = createFileOrderStore({ directory: config?.orderDataDir }), now = Date.now }) {
  const locks = new Map();

  function locked(id, operation) {
    const previous = locks.get(id) || Promise.resolve();
    const pending = previous.catch(() => {}).then(operation);
    locks.set(id, pending);
    return pending.finally(() => { if (locks.get(id) === pending) locks.delete(id); });
  }

  async function load(id) {
    try { return await store.get(id); }
    catch { fail('ORDER_STORAGE_UNAVAILABLE', 503); }
  }

  function inspectInfo(record, info, commandSuccess = false) {
    if (!isObject(info) || !sameId(info.id, record.id) || !sameId(info.organizationId, record.organizationId)) return record;
    const confirmedTerminal = isObject(info.order) && sameId(info.order.terminalGroupId, record.terminalGroupId);
    if (confirmedTerminal && (info.creationStatus === 'Success' || commandSuccess)) {
      const number = info.order?.number;
      return { ...record, status: 'accepted', phase: 'confirmed', ...(Number.isSafeInteger(number) && number >= 0 ? { number } : {}) };
    }
    if (info.creationStatus === 'Error' || info.creationStatus === 'Cancelled') return { ...record, status: 'failed', phase: 'rejected' };
    return record;
  }

  async function saveAfterSubmission(record) {
    try { await store.save(record); return record; }
    catch {
      // The initial durable record still blocks a second POST. A later GET can
      // recover the outcome from iiko even when this state update failed.
      return { ...record, status: 'processing', phase: 'unknown' };
    }
  }

  async function refresh(record) {
    if (record.status !== 'processing') return record;
    const [ordersResult, commandResult] = await Promise.allSettled([
      Promise.resolve().then(() => client.deliveriesById({ organizationId: record.organizationId, orderIds: [record.id] })),
      record.correlationId ? Promise.resolve().then(() => client.commandStatus({ organizationId: record.organizationId, correlationId: record.correlationId })) : Promise.resolve(null),
    ]);
    const command = commandResult.status === 'fulfilled' ? commandResult.value : null;
    const orders = ordersResult.status === 'fulfilled' && Array.isArray(ordersResult.value?.orders) ? ordersResult.value.orders : [];
    const info = orders.find(order => sameId(order?.id, record.id) && sameId(order?.organizationId, record.organizationId));
    let updated = inspectInfo(record, info, command?.state === 'Success');
    if (updated.status === 'processing' && command?.state === 'Error') updated = { ...updated, status: 'failed', phase: 'rejected' };
    if (updated !== record) return saveAfterSubmission(updated);
    return record;
  }

  async function existingOrder(record, accessTokenHash, validated) {
    if (!authorized(record, accessTokenHash)) fail('ORDER_NOT_FOUND', 404);
    if (validated && hash(JSON.stringify(validated)) !== record.fingerprint) fail('REQUEST_CONFLICT', 409);
    return publicOrder(await refresh(record));
  }

  async function create(payload, accessToken) {
    const id = requestId(payload?.requestId);
    const accessTokenHash = tokenHash(accessToken);
    return locked(id, async () => {
      const existing = await load(id);
      if (existing) {
        if (!authorized(existing, accessTokenHash)) fail('ORDER_NOT_FOUND', 404);
        let validated;
        try { validated = validatePayload(payload); }
        catch { fail('REQUEST_CONFLICT', 409); }
        return existingOrder(existing, accessTokenHash, validated);
      }
      if (config.orderingEnabled !== true) fail('ORDERING_DISABLED', 503);
      const { organizationId, terminalGroupId, externalMenuId, priceCategoryId } = config.selection || {};
      if (!UUID.test(organizationId || '') || !UUID.test(terminalGroupId || '') || !externalMenuId) fail('ORDERING_DISABLED', 503);
      const validated = validatePayload(payload);
      let catalog, orderTypes, paymentTypes, alive;
      try {
        [catalog, orderTypes, paymentTypes, alive] = await Promise.all([
          Promise.resolve().then(() => getCatalog({ fresh: true })).catch(() => fail('CATALOG_UNAVAILABLE', 503)),
          client.orderTypes(organizationId), client.paymentTypes(organizationId), client.terminalGroupsAlive(organizationId, terminalGroupId),
        ]);
      } catch (error) {
        if (error instanceof OrderError) throw error;
        fail('IIKO_UNAVAILABLE', 502);
      }
      if (!Array.isArray(alive?.isAliveStatus) || !alive.isAliveStatus.some(group => sameId(group?.organizationId, organizationId) && sameId(group?.terminalGroupId, terminalGroupId) && group.isAlive === true)) fail('POS_UNAVAILABLE', 503);
      const orderType = selectedOrderType(orderTypes, organizationId);
      const payment = selectedCashPayment(paymentTypes, terminalGroupId);
      const items = snapshotItems(validated, catalog);
      const totalCents = items.reduce((sum, item) => sum + item.priceCents * item.quantity, 0);
      if (!Number.isSafeInteger(totalCents) || totalCents > MAX_TOTAL_CENTS) fail('INVALID_ORDER');
      if (totalCents !== validated.expectedTotalCents) fail('PRICE_CHANGED', 409);
      const orderItems = iikoItems(items);
      let stopList;
      try { stopList = await client.checkStopList({ organizationId, terminalGroupId, items: orderItems }); }
      catch { fail('IIKO_UNAVAILABLE', 502); }
      if (!UUID.test(stopList?.correlationId || '') || (stopList.rejectedItems != null && !Array.isArray(stopList.rejectedItems))) fail('IIKO_UNAVAILABLE', 502);
      if (stopList.rejectedItems?.length) fail('ITEM_UNAVAILABLE', 409);

      const record = {
        version: 1, id, organizationId, terminalGroupId, externalMenuId: String(externalMenuId),
        accessTokenHash, fingerprint: hash(JSON.stringify(validated)),
        status: 'processing', phase: 'submitting', items, totalCents, createdAt: new Date(now()).toISOString(),
      };
      let inserted;
      try { inserted = await store.create(record); }
      catch { fail('ORDER_STORAGE_UNAVAILABLE', 503); }
      if (!inserted) return existingOrder(await load(id), accessTokenHash, validated);

      let updated = record;
      try {
        const result = await client.createDelivery({
          organizationId, terminalGroupId,
          createOrderSettings: { checkStopList: true },
          order: {
            id, menuId: String(externalMenuId), orderTypeId: orderType.id,
            phone: validated.customer.phone, customer: { type: 'one-time', name: validated.customer.name },
            comment: validated.comment, sourceKey: 'CafeYalta-demo-site', items: orderItems,
            ...(UUID.test(priceCategoryId || '') ? { priceCategoryId } : {}),
            payments: [{ paymentTypeKind: 'Cash', paymentTypeId: payment.id, sum: totalCents / 100, isProcessedExternally: false, isFiscalizedExternally: false }],
          },
        });
        if (UUID.test(result?.correlationId || '')) updated = { ...updated, correlationId: result.correlationId };
        updated = inspectInfo(updated, result?.orderInfo);
      } catch (error) {
        updated = { ...updated, phase: 'unknown', ...(UUID.test(error?.correlationId || '') ? { correlationId: error.correlationId } : {}) };
      }
      return publicOrder(await saveAfterSubmission(updated));
    });
  }

  async function get(value, accessToken) {
    let id;
    try { id = requestId(value); } catch { fail('ORDER_NOT_FOUND', 404); }
    const accessTokenHash = tokenHash(accessToken);
    return locked(id, async () => existingOrder(await load(id), accessTokenHash));
  }

  return Object.freeze({ create, get });
}
