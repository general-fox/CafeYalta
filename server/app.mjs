import { createServer } from 'node:http';
import { IikoError } from './iiko-client.mjs';

const MENU_CACHE_MS = 5 * 60 * 1000;

// Local integration workbench. It deliberately has no order/payment write routes.
export function createApiServer({ config, client, now = Date.now }) {
  let cachedMenu;
  let pendingMenu;
  const localHosts = new Set([`127.0.0.1:${config.port}`, `localhost:${config.port}`]);
  const origins = new Set([
    'http://localhost:5173', 'http://127.0.0.1:5173',
    `http://localhost:${config.port}`, `http://127.0.0.1:${config.port}`,
  ]);

  async function menu() {
    if (cachedMenu && now() - cachedMenu.timestamp < MENU_CACHE_MS) return cachedMenu.payload;
    if (!pendingMenu) {
      pendingMenu = client.menuById(config.selection).then(data => {
        const timestamp = now();
        const payload = {
          source: 'iiko', mode: 'read-only', orderingEnabled: false,
          organizationId: config.selection.organizationId,
          externalMenuId: config.selection.externalMenuId,
          fetchedAt: new Date(timestamp).toISOString(),
          data,
        };
        cachedMenu = { timestamp, payload };
        return payload;
      }).finally(() => { pendingMenu = undefined; });
    }
    return pendingMenu;
  }

  return createServer(async (request, response) => {
    const send = (status, body) => {
      response.writeHead(status, {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
      });
      response.end(JSON.stringify(body));
    };
    // Binding to loopback plus an exact Host allowlist prevents DNS rebinding.
    if (!localHosts.has(request.headers.host)) return send(403, { error: 'LOCAL_ONLY', message: 'API доступно только локально.' });
    const origin = request.headers.origin;
    if ((origin && !origins.has(origin)) || (!origin && request.headers['sec-fetch-site'] === 'cross-site')) {
      return send(403, { error: 'ORIGIN_NOT_ALLOWED', message: 'Источник запроса не разрешён.' });
    }
    if (origin) {
      response.setHeader('Access-Control-Allow-Origin', origin);
      response.setHeader('Vary', 'Origin');
    }
    if (request.method === 'OPTIONS') {
      response.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
      response.writeHead(204);
      return response.end();
    }
    if (request.method !== 'GET') return send(405, { error: 'READ_ONLY', message: 'Этот сервер только читает меню. Заказы пока не отправляются.' });

    const path = request.url?.split('?')[0];
    if (path === '/api/health') return send(200, {
      service: 'CafeYalta API', mode: 'read-only', orderingEnabled: false,
      credentialsConfigured: config.missingAuth.length === 0,
      menuConfigured: config.missingMenu.length === 0,
      missing: config.missingMenu,
      message: 'Это проверка настроек сервера. Связь с iiko проверяется командой npm run iiko:check.',
    });
    if (path !== '/api/menu') return send(404, { error: 'NOT_FOUND', message: 'Маршрут не найден.' });
    if (config.missingMenu.length) return send(503, {
      error: 'IIKO_NOT_CONFIGURED', missing: config.missingMenu,
      message: 'Заполните server/.env и перезапустите сервер. ID организации и меню покажет npm run iiko:check.',
    });
    try {
      send(200, await menu());
    } catch (error) {
      if (error instanceof IikoError) {
        send(error.status === 429 ? 429 : 502, {
          error: error.code, message: error.message,
          ...(error.correlationId ? { correlationId: error.correlationId } : {}),
        });
      } else send(502, { error: 'IIKO_UNAVAILABLE', message: 'Не удалось получить меню iiko. Повторите позже.' });
    }
  });
}
