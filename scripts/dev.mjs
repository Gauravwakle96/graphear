import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('..', import.meta.url));
const tasks = [
  ['node_modules/tsx/dist/cli.mjs', 'watch', 'apps/api/src/index.ts'],
  ['node_modules/vite/bin/vite.js', '--config', 'apps/web/vite.config.ts'],
];
const children = tasks.map((args) =>
  spawn(process.execPath, args, { cwd: root, stdio: 'inherit' }),
);
let stopped = false;
function stop(code = 0) {
  if (stopped) return;
  stopped = true;
  for (const child of children) child.kill();
  process.exitCode = code;
}
process.on('SIGINT', () => stop());
process.on('SIGTERM', () => stop());
for (const child of children) {
  child.on('error', (error) => {
    console.error(error.message);
    stop(1);
  });
  child.on('exit', (code) => {
    if (!stopped) stop(code ?? 0);
  });
}
