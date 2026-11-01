import { spawn, execFileSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:net';
const root = fileURLToPath(new URL('..', import.meta.url));
const port = Number(process.env.GRAPHEAR_DEMO_PORT ?? 3180);
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('Invalid demo port');
if (!existsSync(resolve(root, 'dist/server.mjs'))) throw new Error('Run npm run build first');
await new Promise((accept, reject) => {
  const probe = createServer();
  probe.once('error', reject);
  probe.listen(port, '127.0.0.1', () => probe.close(accept));
});
const directory = resolve(root, 'data/deployment');
await mkdir(directory, { recursive: true });
const binary =
  process.env.CLOUDFLARED_PATH ||
  (process.platform === 'win32' ? resolve(root, 'data/tools/cloudflared.exe') : 'cloudflared');
const local = 'http://127.0.0.1:' + port;
const tunnel = spawn(binary, ['--no-autoupdate', 'tunnel', '--url', local, '--protocol', 'http2'], {
  cwd: root,
  stdio: ['ignore', 'pipe', 'pipe'],
});
let server;
let stopped = false;
const stop = (code = 0) => {
  if (stopped) return;
  stopped = true;
  server?.kill();
  tunnel.kill();
  process.exitCode = code;
};
process.on('SIGINT', () => stop());
process.on('SIGTERM', () => stop());
try {
  const origin = await new Promise((accept, reject) => {
    const timeout = setTimeout(
      () => reject(new Error('Free HTTPS tunnel did not start within 60 seconds')),
      60_000,
    );
    const output = (data) => {
      const text = String(data);
      const found = text.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/);
      if (found) {
        clearTimeout(timeout);
        accept(found[0]);
      }
    };
    tunnel.stdout.on('data', output);
    tunnel.stderr.on('data', output);
    tunnel.once('error', (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    tunnel.once('exit', () => {
      clearTimeout(timeout);
      reject(new Error('Free tunnel exited before readiness'));
    });
  });
  if (stopped) throw new Error('Demo startup was cancelled');
  server = spawn(process.execPath, ['dist/server.mjs'], {
    cwd: root,
    stdio: 'inherit',
    env: {
      ...process.env,
      NODE_ENV: 'production',
      PORT: String(port),
      HOST: '127.0.0.1',
      APP_PUBLIC_URL: origin,
      ALLOWED_ORIGINS: origin + ',' + local,
      PROXY_TRUST_HOPS: '0',
      DATABASE_PATH: resolve(root, 'data/production/graphear.sqlite'),
      LEARNING_UPLOAD_DIR: resolve(root, 'data/production/learning'),
    },
  });
  server.once('error', (error) => {
    console.error(error.message);
    stop(1);
  });
  server.once('exit', (code) => {
    if (!stopped) stop(code ?? 1);
  });
  tunnel.once('exit', () => {
    if (!stopped) {
      console.error('The free tunnel stopped. Restart the demo for a new URL.');
      stop(1);
    }
  });
  await writeFile(
    resolve(directory, 'current.json'),
    JSON.stringify(
      {
        origin,
        local,
        pid: process.pid,
        serverPid: server.pid,
        tunnelPid: tunnel.pid,
        commit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
        startedAt: new Date().toISOString(),
        mode: 'free-temporary-demo',
      },
      null,
      2,
    ),
  );
  console.log('Free Graphear demo: ' + origin);
  console.log(
    'Runs while this laptop and tunnel are online. URL changes after restart; export private study material before closing.',
  );
} catch (error) {
  console.error(error.message);
  stop(1);
}
