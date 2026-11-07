import { readConfig } from './config.mjs';
import { createIikoClient } from './iiko-client.mjs';
import { createApiServer } from './app.mjs';

try {
  const config = readConfig();
  const server = createApiServer({ config, client: createIikoClient(config.credentials) });
  server.requestTimeout = 20_000;
  server.headersTimeout = 10_000;
  server.on('error', error => {
    console.error(error.code === 'EADDRINUSE'
      ? `Порт ${config.port} уже занят. Остановите прежний сервер или измените API_PORT в server/.env.`
      : 'Не удалось запустить локальный API.');
    process.exitCode = 1;
  });
  server.listen(config.port, '127.0.0.1', () => {
    console.log(`CafeYalta API: http://127.0.0.1:${config.port}/api/health`);
    console.log('Режим: только чтение меню. Отправка заказов отключена.');
    if (config.missingMenu.length) console.log(`Нужно заполнить server/.env: ${config.missingMenu.join(', ')}`);
  });
  for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => {
    server.close();
    server.closeAllConnections();
  });
} catch {
  console.error('Проверьте настройки server/.env: API_PORT должен быть числом от 1024 до 65535.');
  process.exitCode = 1;
}
