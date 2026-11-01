import { performance } from 'node:perf_hooks';
import { mkdir, writeFile } from 'node:fs/promises';
import { analyzeGraph, shortestPath, parseGraph, type Graph } from '../packages/core/src/index';
const cases = [10, 50, 100].map((size) => {
  const graph: Graph = {
    schemaVersion: 1,
    id: `synthetic-${size}`,
    title: `Synthetic ${size}-step chain`,
    description: 'Authored algorithm benchmark, not OCR data or a user study.',
    width: 1000,
    height: 4000,
    nodes: Array.from({ length: size }, (_, i) => ({
      id: `n${i}`,
      label: `Step ${i}`,
      type: i === 0 ? 'start' : i === size - 1 ? 'end' : 'process',
      x: 200,
      y: 20 + i * 38,
      width: 200,
      height: 30,
      review: 'confirmed',
    })),
    edges: Array.from({ length: size - 1 }, (_, i) => ({
      id: `e${i}`,
      source: `n${i}`,
      target: `n${i + 1}`,
      label: '',
      review: 'confirmed',
    })),
  };
  const valid = parseGraph(graph);
  const times: number[] = [];
  for (let i = 0; i < 100; i++) {
    const t = performance.now();
    const analysis = analyzeGraph(valid);
    const path = shortestPath(valid, 'n0', `n${size - 1}`);
    if (analysis.unreachable.length || path.length !== size)
      throw new Error('Graph benchmark correctness failed');
    times.push(performance.now() - t);
  }
  times.sort((a, b) => a - b);
  return {
    nodes: size,
    edges: size - 1,
    runs: times.length,
    medianMs: Number(times[50].toFixed(3)),
    p95Ms: Number(times[95].toFixed(3)),
    correct: true,
  };
});
const report = {
  label: 'Synthetic graph algorithm benchmark; excludes image import and browser rendering',
  node: process.version,
  platform: process.platform,
  measuredAt: new Date().toISOString(),
  cases,
};
await mkdir('docs', { recursive: true });
await writeFile('docs/benchmark.json', JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
