import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { createApp } from './app';
import { Store } from './store';
if (existsSync('.env')) process.loadEnvFile('.env');
const port = Number(process.env.PORT ?? 3001);
if (!Number.isInteger(port) || port < 1 || port > 65535)
  throw new Error('PORT must be an integer between 1 and 65535.');
const store = new Store(resolve(process.env.DATABASE_PATH ?? 'data/graphear.sqlite'));
const app = createApp(store, {
  origins: process.env.ALLOWED_ORIGINS?.split(',')
    .map((s) => s.trim())
    .filter(Boolean),
  production: process.env.NODE_ENV === 'production',
  serveWeb: true,
});
const server = app.listen(port, process.env.HOST ?? '127.0.0.1', () =>
  console.log(`Graphear API listening on port ${port}`),
);
let closing = false;
const close = () => {
  if (closing) return;
  closing = true;
  server.close(() => {
    store.close();
    process.exitCode = 0;
  });
};
process.on('SIGINT', close);
process.on('SIGTERM', close);
