import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { createApp } from './app';
import { Store } from './store';
import { runtimeConfig } from './runtime';
if (process.env.GRAPHEAR_LOAD_ENV !== '0' && existsSync('.env')) process.loadEnvFile('.env');
const runtime = runtimeConfig();
const { port } = runtime;
const store = new Store(resolve(process.env.DATABASE_PATH ?? 'data/graphear.sqlite'));
const app = createApp(store, {
  origins: runtime.origins,
  production: runtime.production,
  proxyHops: runtime.proxyHops,
  serveWeb: true,
});
const server = app.listen(port, process.env.HOST ?? '127.0.0.1', () =>
  console.log(`Graphear API listening on port ${port}`),
);
app.locals.learning.start();
let closing = false;
const close = () => {
  if (closing) return;
  closing = true;
  server.close(async () => {
    await app.locals.learning.stop();
    store.close();
    process.exitCode = 0;
  });
};
process.on('SIGINT', close);
process.on('SIGTERM', close);
