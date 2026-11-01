import { mkdir, writeFile } from 'node:fs/promises';
import { scholarshipGraph, recyclingGraph } from '../packages/core/src/index';
import { graphSvg } from '../apps/web/src/lib/svg';
await mkdir('apps/web/public/examples', { recursive: true });
for (const [name, graph] of [
  ['scholarship', scholarshipGraph],
  ['recycling', recyclingGraph],
] as const) {
  await writeFile(`apps/web/public/examples/${name}.svg`, graphSvg(graph));
  await writeFile(`apps/web/public/examples/${name}.json`, JSON.stringify(graph, null, 2) + '\n');
}
