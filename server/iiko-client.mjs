const ORIGIN = 'https://api-ru.iiko.services';
const REQUEST_TIMEOUT_MS = 15_000;
const TOKEN_CACHE_MS = 55 * 60 * 1000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const messages = {
  IIKO_CONFIG: 'Не настроено подключение к iiko.',
  IIKO_INPUT: 'Не хватает корректных данных для запроса к iiko.',
  IIKO_AUTH: 'Не удалось авторизоваться в iiko.',
  IIKO_REQUEST: 'Не удалось выполнить запрос к iiko.',
  IIKO_RESPONSE: 'iiko вернула некорректный ответ.',
  IIKO_TIMEOUT: 'iiko не ответила вовремя. Повторите запрос позже.',
  IIKO_NETWORK: 'Не удалось связаться с iiko. Повторите запрос позже.',
};

// Only our messages/codes and a UUID correlation ID may cross the API boundary.
// Never attach an upstream body, request options, token, or original error cause.
export class IikoError extends Error {
  constructor(code = 'IIKO_REQUEST', { status = 502, correlationId } = {}) {
    const safeCode = Object.hasOwn(messages, code) ? code : 'IIKO_REQUEST';
    super(messages[safeCode]);
    this.name = 'IikoError';
    this.code = safeCode;
    this.status = Number.isInteger(status) && status >= 400 && status <= 599 ? status : 502;
    if (typeof correlationId === 'string' && UUID.test(correlationId)) this.correlationId = correlationId;
  }
}

function requiredString(value) {
  if (typeof value !== 'string' || !value.trim()) throw new IikoError('IIKO_INPUT', { status: 400 });
  return value.trim();
}

function menuIdentifier(value) {
  if (typeof value === 'number' && Number.isSafeInteger(value) && value > 0) return String(value);
  return requiredString(value);
}

function requiredObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new IikoError('IIKO_INPUT', { status: 400 });
  return value;
}

function requiredArray(value, { max = Infinity, allowEmpty = false } = {}) {
  if (!Array.isArray(value) || (!allowEmpty && value.length === 0) || value.length > max) {
    throw new IikoError('IIKO_INPUT', { status: 400 });
  }
  return value;
}

export function createIikoClient({ appId, clientSecret, apiKey, fetchImpl = globalThis.fetch, now = Date.now } = {}) {
  let cachedToken = null;
  let tokenRequest = null;

  function credentials() {
    if (![appId, clientSecret, apiKey].every(value => typeof value === 'string' && value.trim()) || typeof fetchImpl !== 'function') {
      throw new IikoError('IIKO_CONFIG', { status: 503 });
    }
    return { appId: appId.trim(), clientSecret: clientSecret.trim(), apiKey: apiKey.trim() };
  }

  async function request(path, body, token) {
    const controller = new AbortController();
    let timeout;
    const deadline = new Promise((_, reject) => {
      timeout = setTimeout(() => {
        controller.abort();
        reject(new IikoError('IIKO_TIMEOUT', { status: 504 }));
      }, REQUEST_TIMEOUT_MS);
    });
    try {
      const operation = (async () => {
        const response = await fetchImpl(ORIGIN + path, {
          method: 'POST',
          redirect: 'error',
          signal: controller.signal,
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify(body),
        });
        let result;
        try {
          result = await response.json();
        } catch {
          if (controller.signal.aborted) throw new IikoError('IIKO_TIMEOUT', { status: 504 });
          if (response.ok) throw new IikoError('IIKO_RESPONSE');
        }
        if (!response.ok) {
          throw new IikoError(response.status === 401 || response.status === 403 ? 'IIKO_AUTH' : 'IIKO_REQUEST', {
            status: response.status,
            correlationId: result?.correlationId,
          });
        }
        if (result === null || typeof result !== 'object' || Array.isArray(result)) {
          throw new IikoError('IIKO_RESPONSE');
        }
        return result;
      })();
      return await Promise.race([operation, deadline]);
    } catch (error) {
      if (error instanceof IikoError) throw error;
      throw new IikoError(controller.signal.aborted ? 'IIKO_TIMEOUT' : 'IIKO_NETWORK', { status: controller.signal.aborted ? 504 : 502 });
    } finally {
      clearTimeout(timeout);
    }
  }

  function getToken() {
    const auth = credentials();
    if (cachedToken && now() < cachedToken.expiresAt) return Promise.resolve(cachedToken.value);
    if (!tokenRequest) {
      tokenRequest = request('/api/v2/access_token', auth).then(result => {
        if (typeof result?.token !== 'string' || !result.token.trim()) {
          throw new IikoError('IIKO_RESPONSE', { correlationId: result?.correlationId });
        }
        cachedToken = { value: result.token, expiresAt: now() + TOKEN_CACHE_MS };
        return cachedToken.value;
      }).finally(() => { tokenRequest = null; });
    }
    return tokenRequest;
  }

  async function read(path, body) {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const token = await getToken();
      try {
        return await request(path, body, token);
      } catch (error) {
        if (!(error instanceof IikoError) || error.status !== 401) throw error;
        // A late rejection of the previous token must not evict a fresh one.
        if (cachedToken?.value === token) cachedToken = null;
        if (attempt === 1) throw error;
      }
    }
  }

  // A timeout or an authentication error after submission does not prove that
  // the POS rejected an order. Reconciliation and any explicit retry belong to
  // the order service, which retains the same order UUID.
  async function writeOnce(path, body) {
    const token = await getToken();
    try {
      return await request(path, body, token);
    } catch (error) {
      if (error instanceof IikoError && error.status === 401 && cachedToken?.value === token) cachedToken = null;
      throw error;
    }
  }

  return Object.freeze({
    organizations: () => read('/api/1/organizations', {}),
    organizationDetails: organizationId => read('/api/1/organizations', {
      organizationIds: [requiredString(organizationId)], returnAdditionalInfo: true, includeDisabled: false,
    }),
    externalMenus: organizationId => read('/api/2/menu', organizationId == null ? {} : { organizationIds: [requiredString(organizationId)] }),
    terminalGroups: organizationId => read('/api/1/terminal_groups', { organizationIds: [requiredString(organizationId)], includeDisabled: false }),
    terminalGroupsAlive: (organizationId, terminalGroupId) => read('/api/1/terminal_groups/is_alive', {
      organizationIds: [requiredString(organizationId)], terminalGroupIds: [requiredString(terminalGroupId)],
    }),
    orderTypes: organizationId => read('/api/1/deliveries/order_types', { organizationIds: [requiredString(organizationId)] }),
    paymentTypes: organizationId => read('/api/1/payment_types', { organizationIds: [requiredString(organizationId)] }),
    stopLists: (organizationId, terminalGroupId) => read('/api/1/stop_lists', {
      organizationIds: [requiredString(organizationId)], terminalGroupsIds: [requiredString(terminalGroupId)], returnSize: true,
    }),
    checkStopList: ({ organizationId, terminalGroupId, items } = {}) => read('/api/1/stop_lists/check', {
      organizationId: requiredString(organizationId), terminalGroupId: requiredString(terminalGroupId),
      items: requiredArray(items),
    }),
    createDelivery: ({ organizationId, terminalGroupId, order, createOrderSettings } = {}) => writeOnce('/api/1/deliveries/create', {
      organizationId: requiredString(organizationId), terminalGroupId: requiredString(terminalGroupId),
      order: requiredObject(order),
      ...(createOrderSettings == null ? {} : { createOrderSettings: requiredObject(createOrderSettings) }),
    }),
    commandStatus: ({ organizationId, correlationId } = {}) => read('/api/1/commands/status', {
      organizationId: requiredString(organizationId), correlationId: requiredString(correlationId),
    }),
    deliveriesById: ({ organizationId, orderIds } = {}) => read('/api/1/deliveries/by_id', {
      organizationId: requiredString(organizationId), orderIds: requiredArray(orderIds, { max: 200 }).map(requiredString),
    }),
    menuById: ({ externalMenuId, organizationId, priceCategoryId } = {}) => read('/api/menu/v3/by_id', {
      externalMenuId: menuIdentifier(externalMenuId),
      organizationId: requiredString(organizationId),
      ...(priceCategoryId == null || priceCategoryId === '' ? {} : { priceCategoryId: requiredString(priceCategoryId) }),
    }),
  });
}
