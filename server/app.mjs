import { createServer } from 'node:http';
import { IikoError } from './iiko-client.mjs';
import { normalizeCatalog } from './catalog.mjs';
import { createOrderService, OrderError } from './orders.mjs';
import { createFileOrderStore } from './order-store.mjs';

const MENU_CACHE_MS = 15_000;
const MAX_BODY_BYTES = 16 * 1024;
const ORDER_PATH = /^\/api\/orders\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i;

class ApiError extends Error {
  constructor(status, code, message) { super(message); this.status = status; this.code = code; }
}

function readJson(request) {
  if (request.headers['content-type']?.split(';')[0].trim().toLowerCase() !== 'application/json') {
    request.resume();
    return Promise.reject(new ApiError(415, 'JSON_REQUIRED', 'Отправьте заказ в формате JSON.'));
  }
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    let exceeded = false;
    request.on('data', chunk => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        if (!exceeded) { exceeded = true; reject(new ApiError(413, 'ORDER_TOO_LARGE', 'В заказе слишком много данных.')); }
        return;
      }
      chunks.push(chunk);
    });
    request.once('error', () => reject(new ApiError(400, 'INVALID_ORDER', 'Не удалось прочитать заказ.')));
    request.once('end', () => {
      if (exceeded) return;
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); }
      catch { reject(new ApiError(400, 'INVALID_ORDER', 'Не удалось прочитать заказ.')); }
    });
  });
}

function accessToken(request) {
  return /^Bearer ([A-Za-z0-9._~-]{32,200})$/.exec(request.headers.authorization || '')?.[1] || '';
}

// Bound to loopback: this is a local demonstration, not a public ordering server.
export function createApiServer({ config, client, now = Date.now, orderService, store }) {
  let cachedCatalog;
  let pendingCatalog;
  const orderingEnabled = Boolean(config.orderingEnabled && !config.missingOrder?.length);
  const localHosts = new Set([`127.0.0.1:${config.port}`, `localhost:${config.port}`]);
  const origins = new Set([
    'http://localhost:5180', 'http://127.0.0.1:5180',
    'http://localhost:5173', 'http://127.0.0.1:5173',
    'http://localhost:4173', 'http://127.0.0.1:4173',
    `http://localhost:${config.port}`, `http://127.0.0.1:${config.port}`,
  ]);
  const attempts = new Map();

  async function getCatalog({ fresh = false } = {}) {
    if (!fresh && cachedCatalog && now() - cachedCatalog.timestamp < MENU_CACHE_MS) return cachedCatalog;
    if (!pendingCatalog) {
      pendingCatalog = client.menuById(config.selection).then(data => {
        const catalog = normalizeCatalog(data);
        cachedCatalog = { ...catalog, data, timestamp: now() };
        return cachedCatalog;
      }).finally(() => { pendingCatalog = undefined; });
    }
    return pendingCatalog;
  }

  const orders = orderingEnabled ? orderService || createOrderService({
    config, client, getCatalog, now,
    store: store || createFileOrderStore({ directory: config.orderDataDir }),
  }) : undefined;

  return createServer(async (request, response) => {
    const send = (status, body) => {
      response.writeHead(status, {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff',
        'Referrer-Policy': 'no-referrer',
      });
      response.end(JSON.stringify(body));
    };
    if (!localHosts.has(request.headers.host)) return send(403, { error: 'LOCAL_ONLY', message: 'Сервис доступен только на этом компьютере.' });
    const origin = request.headers.origin;
    if ((origin && !origins.has(origin)) || (!origin && request.headers['sec-fetch-site'] === 'cross-site')) {
      return send(403, { error: 'ORIGIN_NOT_ALLOWED', message: 'Источник запроса не разрешён.' });
    }
    if (origin) {
      response.setHeader('Access-Control-Allow-Origin', origin);
      response.setHeader('Vary', 'Origin');
    }
    if (request.method === 'OPTIONS') {
      response.setHeader('Access-Control-Allow-Methods', orderingEnabled ? 'GET, POST, OPTIONS' : 'GET, OPTIONS');
      response.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      response.writeHead(204);
      return response.end();
    }

    const path = request.url?.split('?')[0];
    try {
      if (request.method === 'GET' && path === '/api/health') return send(200, {
        service: 'CafeYalta API', mode: orderingEnabled ? 'demo-ordering' : 'read-only', orderingEnabled,
        credentialsConfigured: config.missingAuth.length === 0,
        menuConfigured: config.missingMenu.length === 0,
        missing: config.missingMenu,
        message: 'Это проверка настроек сервера. Связь с iiko проверяется командой npm run iiko:check.',
      });
      if (request.method === 'GET' && path === '/api/menu') {
        if (config.missingMenu.length) return send(503, {
          error: 'IIKO_NOT_CONFIGURED', missing: config.missingMenu,
          message: 'Заполните server/.env и перезапустите сервер. ID организации и меню покажет npm run iiko:check.',
        });
        const fresh = new URL(request.url, 'http://localhost').searchParams.get('refresh') === '1';
        const catalog = await getCatalog({ fresh });
        const ordering = orderingEnabled && typeof orders?.capabilities === 'function'
          ? await orders.capabilities()
          : { methods: orderingEnabled ? ['pickup'] : [], payment: 'cash_on_receipt', deliveryFee: 0, addressFormat: null };
        return send(200, {
          source: 'iiko', mode: orderingEnabled ? 'demo-ordering' : 'read-only', orderingEnabled,
          organizationId: config.selection.organizationId, externalMenuId: config.selection.externalMenuId,
          fetchedAt: new Date(catalog.timestamp).toISOString(),
          categories: catalog.categories, products: catalog.products, warnings: catalog.warnings,
          ordering,
          data: catalog.data,
        });
      }
      if (request.method !== 'GET' && !orderingEnabled) return send(405, { error: 'READ_ONLY', message: 'Отправка заказов пока отключена.' });
      if (request.method === 'POST' && path === '/api/orders') {
        if (!origin) return send(403, { error: 'ORDER_ORIGIN_REQUIRED', message: 'Оформите заказ на странице сайта.' });
        const token = accessToken(request);
        if (!token) return send(401, { error: 'ORDER_TOKEN_REQUIRED', message: 'Не удалось подтвердить доступ к заказу. Обновите страницу.' });
        const key = request.socket.remoteAddress || 'local';
        const previous = attempts.get(key);
        const attempt = !previous || now() - previous.startedAt >= 60_000 ? { startedAt: now(), count: 0 } : previous;
        attempts.set(key, attempt);
        if (++attempt.count > 20) return send(429, { error: 'TOO_MANY_ORDERS', message: 'Слишком много попыток. Подождите минуту.' });
        const result = await orders.create(await readJson(request), token);
        return send(result.status === 'processing' ? 202 : 200, result);
      }
      const match = ORDER_PATH.exec(path || '');
      if (request.method === 'GET' && match && orders) {
        const token = accessToken(request);
        if (!token) return send(404, { error: 'ORDER_NOT_FOUND', message: 'Заказ не найден.' });
        return send(200, await orders.get(match[1], token));
      }
      return send(404, { error: 'NOT_FOUND', message: 'Маршрут не найден.' });
    } catch (error) {
      if (error instanceof OrderError || error instanceof ApiError) return send(error.status, { error: error.code, message: error.message });
      if (error instanceof IikoError) return send(error.status === 429 ? 429 : 502, {
        error: error.code, message: error.message,
        ...(error.correlationId ? { correlationId: error.correlationId } : {}),
      });
      const orderRequest = path === '/api/orders' || ORDER_PATH.test(path || '');
      return send(502, {
        error: orderRequest ? 'ORDER_STATE_UNKNOWN' : 'IIKO_UNAVAILABLE',
        message: orderRequest
          ? 'Результат передачи заказа пока не подтверждён. Проверьте состояние этой же заявки.'
          : 'Не удалось завершить проверку. Повторите попытку позже.',
      });
    }
  });
}
