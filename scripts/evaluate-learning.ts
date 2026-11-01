import { existsSync } from 'node:fs';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve, dirname, join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { Store } from '../apps/api/src/store';
import { LearningStore } from '../apps/api/src/learning/store';
import { LearningService } from '../apps/api/src/learning/service';
import { aiConfig, configured } from '../apps/api/src/ai/config';
import { persistUpload, removePrivate } from '../apps/api/src/learning/files';
import { youtubeId, youtubeMetadata } from '../apps/api/src/learning/youtube';
import type { LearningInput } from '../apps/api/src/learning/store';
if (existsSync('.env')) process.loadEnvFile('.env');
const config = aiConfig();
if (!configured(config)) {
  console.error(
    'Live evaluation was NOT run: configure the selected provider key in backend .env. Never paste it into chat.',
  );
  process.exitCode = 2;
} else {
  const argument = process.argv.indexOf('--manifest'),
    manifestPath = argument >= 0 ? resolve(process.argv[argument + 1]) : null;
  if (!manifestPath)
    throw new Error('Pass --manifest <JSON file>. This command makes billable real AI requests.');
  const manifest = z
    .array(
      z
        .object({
          name: z.string(),
          file: z.string().optional(),
          text: z.string().optional(),
          youtube: z.string().optional(),
          expectedKind: z.string(),
          expectedNodes: z.array(
            z.object({ name: z.string(), aliases: z.array(z.string()).min(1) }),
          ),
          expectedEdges: z.array(
            z.object({
              from: z.string(),
              to: z.string(),
              label: z.string().optional(),
              direction: z.enum(['forward', 'none']).default('forward'),
            }),
          ),
          requiredNotePhrases: z.array(z.string()).default([]),
        })
        .strict(),
    )
    .parse(JSON.parse(await readFile(manifestPath, 'utf8')));
  const directory = resolve('data/live-evaluation/' + randomUUID());
  await mkdir(directory, { recursive: true });
  config.uploadDir = join(directory, 'uploads');
  const base = new Store(join(directory, 'evaluation.sqlite')),
    store = new LearningStore(base),
    service = new LearningService(store, config),
    owner = randomUUID();
  base.createSession(owner, randomUUID());
  service.start();
  const results: unknown[] = [];
  try {
    for (const item of manifest) {
      let input: LearningInput = {
        kind: item.youtube ? 'youtube' : item.file ? 'file' : 'text',
        name: item.name,
        path: null,
        mime: null,
        text: item.text ?? '',
        url: null,
        videoId: null,
        duration: null,
        embed: false,
      };
      if (item.file) {
        const path = resolve(dirname(manifestPath), item.file);
        const file = await persistUpload(await readFile(path), path.split(/[\\/]/).at(-1)!, config);
        input = { ...input, ...file };
      }
      if (item.youtube) {
        const videoId = youtubeId(item.youtube),
          metadata = await youtubeMetadata(videoId, config);
        input = {
          ...input,
          videoId,
          url: metadata.url,
          duration: metadata.duration,
          embed: metadata.embed,
        };
      }
      const s = store.create(
        owner,
        input,
        {
          subject: 'General education',
          difficulty: 'medium',
          questionCount: 3,
          consent: true,
          noteStyle: 'detailed',
        },
        1,
        true,
      );
      const started = Date.now();
      let current = store.get(owner, s.id)!;
      while (
        ['queued', 'extracting', 'generating'].includes(current.status) &&
        Date.now() - started < 21 * 60_000
      ) {
        await new Promise((r) => setTimeout(r, 1000));
        current = store.get(owner, s.id)!;
      }
      if (!current.analysis) {
        results.push({ name: item.name, status: current.status, error: current.error });
        console.log(item.name + ': ' + current.status);
        continue;
      }
      const a = current.analysis;
      const graph = a.diagrams.find((d) => d.kind === item.expectedKind) ?? a.diagrams[0];
      const mapping = new Map<string, string>();
      if (graph)
        for (const n of graph.nodes) {
          const match = item.expectedNodes.find((e) =>
            e.aliases.some((alias) => n.label.toLowerCase().includes(alias.toLowerCase())),
          );
          if (match) mapping.set(n.id, match.name);
        }
      const actual =
        graph?.edges.flatMap((e) => {
          const edge = {
            from: mapping.get(e.source) ?? 'unmapped:' + e.source,
            to: mapping.get(e.target) ?? 'unmapped:' + e.target,
            label: e.label,
            direction: e.direction === 'none' ? 'none' : 'forward',
          };
          return e.direction === 'both'
            ? [edge, { ...edge, from: edge.to, to: edge.from }]
            : [edge];
        }) ?? [];
      const matchesEdge = (v: (typeof actual)[number], e: (typeof item.expectedEdges)[number]) =>
        v.direction === e.direction &&
        ((v.from === e.from && v.to === e.to) ||
          (e.direction === 'none' && v.from === e.to && v.to === e.from)) &&
        (!e.label || v.label.toLowerCase().includes(e.label.toLowerCase()));
      const matched = item.expectedEdges.filter((e) => actual.some((v) => matchesEdge(v, e)));
      const unexpected = actual.filter((v) => !item.expectedEdges.some((e) => matchesEdge(v, e)));
      const notes = JSON.stringify(a.notes).toLowerCase();
      const record = {
        name: item.name,
        status: 'completed',
        kindExpected: item.expectedKind,
        kindActual: graph?.kind ?? null,
        matchedNodes: [...new Set(mapping.values())],
        missingNodes: item.expectedNodes
          .filter((n) => ![...mapping.values()].includes(n.name))
          .map((n) => n.name),
        expectedEdges: item.expectedEdges.length,
        matchedEdges: matched.length,
        missingEdges: item.expectedEdges.filter((e) => !matched.includes(e)),
        unexpectedEdges: unexpected,
        edgeRecall: item.expectedEdges.length ? matched.length / item.expectedEdges.length : null,
        missingNotePhrases: item.requiredNotePhrases.filter(
          (p) => !notes.includes(p.toLowerCase()),
        ),
        warnings: a.warnings,
        manualSemanticReview:
          'Required. Label/edge matching cannot certify technical meaning or factual accuracy.',
      };
      results.push(record);
      await writeFile(
        join(directory, s.id + '.json'),
        JSON.stringify(
          { analysis: a, sources: current.sources.map(({ asset: _asset, ...src }) => src) },
          null,
          2,
        ),
      );
      console.log(item.name + ': completed; review saved results.');
      for (const file of new Set(
        [current.input.path, ...current.sources.map((s) => s.asset)].filter(Boolean) as string[],
      ))
        await removePrivate(config, file);
    }
  } finally {
    await service.stop();
    base.close();
    await writeFile(
      join(directory, 'report.json'),
      JSON.stringify(
        { provider: config.provider, model: config.model, live: true, results },
        null,
        2,
      ),
    );
    console.log('Private evaluation report: ' + join(directory, 'report.json'));
  }
  if (results.some((r) => (r as { status: string }).status !== 'completed')) process.exitCode = 1;
}
