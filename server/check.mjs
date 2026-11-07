import { readConfig } from './config.mjs';
import { createIikoClient, IikoError } from './iiko-client.mjs';

const plain = value => String(value ?? '').replace(/[\x00-\x1f\x7f-\x9f\u202a-\u202e\u2066-\u2069]/g, '').slice(0, 160);

async function check() {
  const config = readConfig();
  if (config.missingAuth.length) {
    console.error(`В server/.env не заполнены: ${config.missingAuth.join(', ')}`);
    console.error('appId и clientSecret: https://api.iiko.help/portal; API-ключ: iikoWeb → Настройки Cloud API.');
    console.error('Заполните файл локально. Не присылайте значения в чат и не добавляйте в Git.');
    process.exitCode = 2;
    return;
  }
  const client = createIikoClient(config.credentials);
  const result = await client.organizations();
  const organizations = Array.isArray(result.organizations) ? result.organizations : [];
  console.log('Авторизация iiko выполнена. Токен и ключи не выводятся.');
  console.log('Доступные организации:');
  for (const item of organizations) console.log(`  ${plain(item.name)} — ${plain(item.id)}`);
  if (!organizations.length) {
    console.error('Ключ не вернул доступных организаций. Проверьте подключённые точки в iikoWeb.');
    process.exitCode = 2;
    return;
  }

  const selected = config.selection.organizationId;
  if (selected && !organizations.some(item => item.id === selected)) {
    console.error('IIKO_ORGANIZATION_ID не найден среди организаций этого ключа. Проверьте выбранный ID.');
    process.exitCode = 2;
    return;
  }
  const menus = await client.externalMenus(selected || undefined);
  console.log('Внешние меню:');
  const externalMenus = Array.isArray(menus.externalMenus) ? menus.externalMenus : [];
  for (const item of externalMenus) console.log(`  ${plain(item.name)} — ${plain(item.id ?? item.externalMenuId)}`);
  if (!externalMenus.length) console.log('  Список пуст. Создайте и опубликуйте внешнее меню в iikoWeb.');
  if (Array.isArray(menus.priceCategories) && menus.priceCategories.length) {
    console.log('Ценовые категории (необязательно):');
    for (const item of menus.priceCategories) console.log(`  ${plain(item.name)} — ${plain(item.id)}`);
  }
  if (!selected || !config.selection.externalMenuId) {
    console.log('Укажите IIKO_ORGANIZATION_ID и IIKO_EXTERNAL_MENU_ID в server/.env, затем повторите проверку.');
    return;
  }
  const menu = await client.menuById(config.selection);
  console.log('Ответ выбранного меню получен.');
  if (Array.isArray(menu.itemsGroups)) {
    const count = menu.itemsGroups.reduce((sum, group) => sum + (Array.isArray(group.items) ? group.items.length : 0), 0);
    console.log(`В ответе: ${menu.itemsGroups.length} групп, ${count} позиций в группах.`);
  }
  console.log(`Просмотр ответа меню: npm run api, затем http://127.0.0.1:${config.port}/api/menu`);
  console.log('Это проверка чтения. Заказы, платежи и брони не создавались; касса ещё не проверена приёмом заказа.');
}

check().catch(error => {
  console.error(error instanceof IikoError ? error.message : 'Проверка не завершена. Проверьте настройки server/.env и повторите.');
  if (error instanceof IikoError && error.correlationId) console.error(`Код обращения iiko: ${error.correlationId}`);
  process.exitCode = 1;
});
