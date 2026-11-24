import { fileURLToPath } from 'node:url';

export const AUTH_KEYS = ['IIKO_APP_ID', 'IIKO_CLIENT_SECRET', 'IIKO_API_KEY'];
export const MENU_KEYS = [...AUTH_KEYS, 'IIKO_ORGANIZATION_ID', 'IIKO_EXTERNAL_MENU_ID'];
export const ORDER_KEYS = [...MENU_KEYS, 'IIKO_TERMINAL_GROUP_ID'];

export function readConfig(env = process.env) {
  const value = name => String(env[name] || '').trim();
  const port = Number(value('API_PORT') || 3001);
  if (!Number.isInteger(port) || port < 1024 || port > 65535) {
    throw new Error('API_PORT должен быть целым числом от 1024 до 65535.');
  }
  // The menu v3 request requires a string even when the menu list returns a number.
  const externalMenuId = value('IIKO_EXTERNAL_MENU_ID');
  const missingOrder = ORDER_KEYS.filter(name => !value(name));
  return {
    port,
    credentials: { appId: value('IIKO_APP_ID'), clientSecret: value('IIKO_CLIENT_SECRET'), apiKey: value('IIKO_API_KEY') },
    selection: { organizationId: value('IIKO_ORGANIZATION_ID'), externalMenuId, priceCategoryId: value('IIKO_PRICE_CATEGORY_ID') || undefined, terminalGroupId: value('IIKO_TERMINAL_GROUP_ID') || undefined },
    orderingEnabled: value('IIKO_ORDERING_ENABLED') === 'true' && missingOrder.length === 0,
    orderDataDir: fileURLToPath(new URL('./.data/orders/', import.meta.url)),
    missingAuth: AUTH_KEYS.filter(name => !value(name)),
    missingMenu: MENU_KEYS.filter(name => !value(name)),
    missingOrder,
  };
}
