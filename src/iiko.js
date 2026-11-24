export const CHECKOUT_STORAGE_KEY = 'yalta-iiko-checkout-v1';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const SAFE_REJECTION_CODES = new Set([
  'INVALID_ORDER', 'PRICE_CHANGED', 'ITEM_UNAVAILABLE', 'ORDERING_DISABLED',
  'POS_UNAVAILABLE', 'PICKUP_UNAVAILABLE', 'CASH_PAYMENT_UNAVAILABLE',
  'CATALOG_UNAVAILABLE', 'IIKO_UNAVAILABLE',
]);

export function reconcileIikoCart(cart, products) {
  const byId = new Map(products.map(product => [product.id, product]));
  return (Array.isArray(cart) ? cart : []).filter(item => item && typeof item.id === 'string' && Number.isInteger(item.quantity) && item.quantity > 0).map(item => {
    const current = byId.get(item.id);
    return current
      ? { ...current, quantity: Math.min(item.quantity, 30) }
      : { ...item, source: 'iiko', available: false, unavailableReason: 'Этого блюда больше нет в меню' };
  });
}

export function createCheckoutAttempt({ cart, customer, comment = '', uuid = () => crypto.randomUUID(), now = () => new Date().toISOString() }) {
  const requestId = uuid();
  const token = uuid();
  return {
    requestId, token, createdAt: now(),
    payload: {
      requestId, method: 'pickup', customer, comment,
      items: cart.map(({ id, quantity }) => ({ id, quantity })),
      expectedTotal: Math.round(cart.reduce((sum, item) => sum + item.price * item.quantity, 0) * 100) / 100,
    },
    snapshotItems: cart.map(item => ({ ...item })),
  };
}

export function persistCheckoutAttempt(storage, attempt) {
  if (attempt) storage.setItem(CHECKOUT_STORAGE_KEY, JSON.stringify(attempt));
  else storage.removeItem(CHECKOUT_STORAGE_KEY);
}

export function commitCheckoutTransition(storage, reference, next, expectedRequestId, { clearTerminal = false } = {}) {
  if (expectedRequestId !== undefined && reference.current?.requestId !== expectedRequestId) return false;
  if (['accepted', 'failed'].includes(reference.current?.result?.status) && !(next === null && clearTerminal)) return false;
  persistCheckoutAttempt(storage, next);
  reference.current = next;
  return true;
}

export function readCheckoutAttempt(storage) {
  const raw = storage.getItem(CHECKOUT_STORAGE_KEY);
  if (!raw) return null;
  const record = JSON.parse(raw);
  if (!UUID.test(record?.requestId || '') || !UUID.test(record?.token || '') || record.payload?.requestId !== record.requestId || !Array.isArray(record.payload?.items) || !Array.isArray(record.snapshotItems)) throw new Error('INVALID_SAVED_ORDER');
  return record;
}

export function isOrderPending(attempt) {
  return Boolean(attempt && !['accepted', 'failed'].includes(attempt.result?.status));
}

export async function apiRequest(path, { method = 'GET', token, body, signal } = {}) {
  const controller = new AbortController();
  const onAbort = () => controller.abort();
  signal?.addEventListener('abort', onAbort, { once: true });
  if (signal?.aborted) controller.abort();
  const timer = setTimeout(() => controller.abort(), 20_000);
  try {
    const response = await fetch(path, {
      method, signal: controller.signal,
      headers: { Accept: 'application/json', ...(body ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    let data;
    try { data = await response.json(); } catch { throw new Error('Не удалось прочитать ответ. Проверьте состояние заказа.'); }
    if (!response.ok) {
      const error = new Error(typeof data?.message === 'string' ? data.message : 'Не удалось выполнить запрос. Повторите проверку.');
      error.code = data?.error;
      error.httpStatus = response.status;
      throw error;
    }
    return data;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onAbort);
  }
}

export function validateOrderResult(data, requestId) {
  if (!data || data.id !== requestId || !['processing', 'accepted', 'failed'].includes(data.status) || !Array.isArray(data.items) || !Number.isFinite(data.total)) throw new Error('Не удалось подтвердить состояние заказа. Повторите проверку.');
  return data;
}
