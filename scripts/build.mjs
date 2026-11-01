import { build as viteBuild } from 'vite';
import { build as bundle } from 'esbuild';
await viteBuild({ configFile: 'apps/web/vite.config.ts' });
await bundle({
  entryPoints: ['apps/api/src/index.ts'],
  outfile: 'dist/server.mjs',
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node24',
  external: ['express', 'helmet', 'zod'],
  sourcemap: true,
});
