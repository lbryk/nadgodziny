import { loadConfig } from './config';
import { buildApp } from './app';
import { Store } from './store';

const config = loadConfig();
const store = await Store.open(config.dataDir);
const app = await buildApp({ config, store });

if (config.NODE_ENV === 'production' && !config.COOKIE_SECURE) {
  app.log.warn(
    'COOKIE_SECURE is off. Enable it (COOKIE_SECURE=1) once the site is served over HTTPS.',
  );
}

const shutdown = async (signal: string) => {
  app.log.info({ signal }, 'shutting down');
  await app.close();
  process.exit(0);
};
process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));

try {
  await app.listen({ host: config.HOST, port: config.PORT });
} catch (error) {
  app.log.error(error);
  process.exit(1);
}
