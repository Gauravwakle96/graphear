import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import sharp from 'sharp';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Server } from 'node:http';
import { createApp } from '../app';
import { Store } from '../store';
import { aiConfig } from '../ai/config';
import { AIOutputValidationError, type AIProvider, type Generation } from '../ai/providers';
import { LearningService } from './service';
import { testAnalysis } from '../../../../packages/core/src/study.test-support';
const origin = 'http://127.0.0.1:5173';
let server: Server, base: string, dir: string, service: LearningService;
const store = new Store(':memory:');
let calls = 0;
let lastGeneration: Generation | undefined;
let largeGeneration = false,
  invalidRefinement = false;
let invalidGeneration: 'none' | 'once' | 'always' | 'ungrounded-once' | 'ungrounded-always' =
  'none';
// Dependency injection is confined to this test. No mock provider exists in runtime code.
const provider: AIProvider = {
  name: 'test-only',
  async generate(r: Generation) {
    calls++;
    lastGeneration = r;
    if (r.name === 'source_diagram') {
      const diagram = testAnalysis().diagrams[0];
      diagram.title = 'Focused source diagram';
      if (invalidRefinement) diagram.edges[0].target = 'missing';
      return diagram;
    }
    if (invalidGeneration === 'ungrounded-once' || invalidGeneration === 'ungrounded-always') {
      if (invalidGeneration === 'ungrounded-once') invalidGeneration = 'none';
      const invalid = testAnalysis();
      invalid.diagrams[0].edges[0].evidence = ['missing'];
      return invalid;
    }
    if (invalidGeneration === 'once' || invalidGeneration === 'always') {
      if (invalidGeneration === 'once') invalidGeneration = 'none';
      const invalid = r.schema.safeParse({});
      if (!invalid.success) throw new AIOutputValidationError({}, invalid.error.issues, r);
    }
    if (r.name === 'study_tutor')
      return {
        answer: 'The client sends the request.',
        evidence: ['text0'],
        additionalExplanation: false,
        uncertain: false,
        diagram: null,
      };
    if (r.name === 'practice_questions') return { questions: testAnalysis().questions };
    const analysis = testAnalysis();
    if (largeGeneration)
      analysis.notes.detailed = Array.from({ length: 6 }, (_, i) => ({
        heading: `Synthetic section ${i + 1}`,
        items: [...analysis.notes.detailed[0].items, ...analysis.notes.detailed[0].items],
      }));
    return analysis;
  },
  async transcribe() {
    return 'Test only';
  },
};
beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), 'graphear-api-learning-'));
  const app = createApp(store, {
    learning: {
      config: {
        ...aiConfig(),
        compatibleKey: 'test-only-key',
        model: 'test-only-model',
        compatibleRepairInvalidJSON: true,
        provider: 'compatible',
        uploadDir: dir,
        dailyCalls: 100,
        jobCalls: 12,
      },
      provider,
    },
  });
  service = app.locals.learning;
  service.start();
  server = app.listen(0, '127.0.0.1');
  await new Promise<void>((r) => server.once('listening', r));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('No test server');
  base = `http://127.0.0.1:${address.port}`;
});
afterAll(async () => {
  await service.stop();
  await new Promise<void>((r) => server.close(() => r()));
  store.close();
  await rm(dir, { recursive: true, force: true });
});
type Guest = { cookie: string; csrf: string };
async function guest() {
  const res = await fetch(base + '/api/session', { method: 'POST', headers: { Origin: origin } });
  return {
    cookie: res.headers.get('set-cookie')!.split(';')[0],
    csrf: (await res.json()).csrfToken,
  } as Guest;
}
const headers = (g: Guest) => ({ Origin: origin, Cookie: g.cookie, 'X-CSRF-Token': g.csrf });
async function create(g: Guest, process = true) {
  const form = new FormData();
  form.set('kind', 'text');
  form.set('text', 'A client sends a request to a server. The server sends a response.');
  form.set('process', String(process));
  form.set('options', JSON.stringify({ consent: true, questionCount: 1 }));
  const res = await fetch(base + '/api/learning', {
    method: 'POST',
    headers: headers(g),
    body: form,
  });
  expect(res.status).toBe(201);
  return (await res.json()) as { id: string; revision: number };
}
async function get(g: Guest, id: string) {
  return fetch(base + '/api/learning/' + id, { headers: headers(g) });
}
async function done(g: Guest, id: string) {
  for (let i = 0; i < 50; i++) {
    const data = await (await get(g, id)).json();
    if (data.status === 'completed' || data.status === 'failed') return data;
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error('Job did not finish');
}
describe('private learning API and durable jobs', () => {
  it('saves timed-test results with unanswered choices and rejects client-supplied scores', async () => {
    const g = await guest(),
      session = await create(g);
    await done(g, session.id);
    const submit = (body: unknown) =>
      fetch(base + '/api/learning/' + session.id + '/quiz', {
        method: 'POST',
        headers: { ...headers(g), 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
    const response = await submit({
      answers: {},
      mode: 'timed',
      timeLimitSeconds: 60,
      durationSeconds: 60,
    });
    expect(response.status).toBe(200);
    const attempt = (await response.json()).quizAttempts.at(-1);
    expect(attempt).toMatchObject({ correct: 0, total: 1, mode: 'timed' });
    expect(attempt.results[0]).toMatchObject({ questionId: 'q1', correct: false, givenAnswer: '' });
    expect((await submit({ answers: { q1: 'Client' }, score: 100 })).status).toBe(400);
    expect((await submit({ answers: {}, mode: 'practice' })).status).toBe(400);
  });
  it('adds transcripts to owned YouTube drafts without AI calls or replacing completed content', async () => {
    const g = await guest(),
      foreign = await guest(),
      initial = await create(g, false);
    const owner = String(
      store.db.prepare('SELECT owner FROM learning_sessions WHERE id=?').get(initial.id)!.owner,
    );
    const draft = service.store.create(
      owner,
      {
        kind: 'youtube',
        name: 'Synthetic authorized transcript',
        mime: null,
        path: null,
        text: '',
        url: 'https://www.youtube.com/watch?v=abcdefghijk',
        videoId: 'abcdefghijk',
        duration: null,
        embed: false,
      },
      {
        consent: true,
        subject: 'Networks',
        difficulty: 'easy',
        questionCount: 1,
        noteStyle: 'short',
      },
      168,
      false,
    );
    const before = calls;
    const submit = (who: Guest, revision: number) =>
      fetch(base + '/api/learning/' + draft.id + '/source', {
        method: 'POST',
        headers: { ...headers(who), 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: '0:01\nA client sends a request.', revision }),
      });
    expect((await submit(foreign, draft.revision)).status).toBe(404);
    const updated = await submit(g, draft.revision);
    expect(updated.status).toBe(200);
    expect((await updated.json()).input.text).toContain('client sends');
    expect((await submit(g, draft.revision)).status).toBe(409);
    expect(calls).toBe(before);
  });
  it('blocks unauthenticated access and foreign mutations', async () => {
    expect((await fetch(base + '/api/learning')).status).toBe(401);
    const g = await guest();
    const response = await fetch(base + '/api/learning', {
      method: 'POST',
      headers: { ...headers(g), Origin: 'https://foreign.example' },
      body: new FormData(),
    });
    expect(response.status).toBe(403);
  });
  it('validates consent and upload contents before storing a session', async () => {
    const g = await guest();
    const form = new FormData();
    form.set('kind', 'file');
    form.set('file', new Blob(['script']), 'fake.png');
    form.set('options', JSON.stringify({ consent: true }));
    expect(
      (await fetch(base + '/api/learning', { method: 'POST', headers: headers(g), body: form }))
        .status,
    ).toBe(400);
    form.set('options', JSON.stringify({ consent: false }));
    expect(
      (await fetch(base + '/api/learning', { method: 'POST', headers: headers(g), body: form }))
        .status,
    ).toBe(400);
  });
  it('processes a persisted text session and reuses results without repeated analysis', async () => {
    const g = await guest(),
      s = await create(g);
    const ready = await done(g, s.id);
    expect(ready.status).toBe('completed');
    expect(ready.analysis.diagrams[0].edges).toHaveLength(2);
    expect(ready.owner).toBeUndefined();
    expect(ready.input.path).toBeUndefined();
    const before = calls;
    await fetch(base + `/api/learning/${s.id}/process`, { method: 'POST', headers: headers(g) });
    expect(calls).toBe(before);
  });
  it('requires ownership and revision for explicit text-only retry and preserves figure uncertainty', async () => {
    const g = await guest(),
      other = await guest(),
      draft = await create(g, false);
    const row = store.db.prepare('SELECT owner FROM learning_sessions WHERE id=?').get(draft.id)!;
    let current = service.store.get(String(row.owner), draft.id)!;
    const asset = join(dir, 'native-page.jpg');
    await writeFile(
      asset,
      await sharp({ create: { width: 20, height: 20, channels: 3, background: 'white' } })
        .jpeg()
        .toBuffer(),
    );
    current.sources = [
      {
        id: 'text0',
        reference: 'Page 1',
        kind: 'page',
        text: 'A client sends a request to a server. The server sends a response.',
        page: 1,
        start: null,
        end: null,
        asset,
      },
    ];
    current.status = 'failed';
    current = service.store.write(current)!;
    const retry = (who: Guest, revision: number) =>
      fetch(base + `/api/learning/${draft.id}/process`, {
        method: 'POST',
        headers: { ...headers(who), 'Content-Type': 'application/json' },
        body: JSON.stringify({ visualAnalysis: false, revision }),
      });
    expect((await retry(other, current.revision)).status).toBe(404);
    expect((await retry(g, current.revision - 1)).status).toBe(409);
    expect((await retry(g, current.revision)).status).toBe(200);
    const ready = await done(g, draft.id);
    expect(ready.status).toBe('completed');
    expect(ready.options.visualAnalysis).toBe(false);
    expect(ready.analysis.warnings.join(' ')).toContain('not inspected');
    expect(lastGeneration?.images).toEqual([]);
    expect(ready.sources[0].reference).toBe('Page 1');
    expect(ready.sources[0].asset).toBe(`/api/learning/${draft.id}/sources/text0`);
    const empty = await create(g, false);
    const rejected = await fetch(base + `/api/learning/${empty.id}/process`, {
      method: 'POST',
      headers: { ...headers(g), 'Content-Type': 'application/json' },
      body: JSON.stringify({ visualAnalysis: false, revision: empty.revision }),
    });
    expect(rejected.status).toBe(400);
    const noText = await (await get(g, empty.id)).json();
    expect(noText.status).toBe('draft');
  });
  it('prevents another owner reading, editing, exporting or deleting material', async () => {
    const a = await guest(),
      b = await guest(),
      s = await create(a, false);
    for (const path of ['', '/file', '/export/pdf'])
      expect(
        (await fetch(base + `/api/learning/${s.id}${path}`, { headers: headers(b) })).status,
      ).toBe(404);
    for (const method of ['PATCH', 'DELETE'])
      expect(
        (
          await fetch(base + `/api/learning/${s.id}`, {
            method,
            headers: { ...headers(b), 'Content-Type': 'application/json' },
            body: method === 'PATCH' ? JSON.stringify({ title: 'other', revision: 1 }) : undefined,
          })
        ).status,
      ).toBe(404);
  });
  it('checks cited document figures and keeps valid notes when a reconstruction is invalid or over budget', async () => {
    const previousBudget = service.config.jobCalls;
    try {
      largeGeneration = true;
      const asset = join(dir, 'figure-review.jpg');
      await writeFile(
        asset,
        await sharp({ create: { width: 20, height: 20, channels: 3, background: 'white' } })
          .jpeg()
          .toBuffer(),
      );
      for (const mode of ['valid', 'invalid', 'budget'] as const) {
        invalidRefinement = mode === 'invalid';
        service.config.jobCalls = mode === 'budget' ? 1 : 12;
        const g = await guest(),
          draft = await create(g, false);
        const owner = String(
          store.db.prepare('SELECT owner FROM learning_sessions WHERE id=?').get(draft.id)!.owner,
        );
        const current = service.store.get(owner, draft.id)!;
        current.sources = Array.from({ length: 5 }, (_, i) => ({
          id: `text${i}`,
          reference: `Page ${i + 1}`,
          kind: 'page' as const,
          text: 'A client sends a request to a server. '.repeat(50),
          page: i + 1,
          start: null,
          end: null,
          asset: i === 0 ? asset : null,
        }));
        service.store.write(current);
        const before = calls;
        expect(
          (
            await fetch(base + `/api/learning/${draft.id}/process`, {
              method: 'POST',
              headers: headers(g),
            })
          ).status,
        ).toBe(200);
        const ready = await done(g, draft.id);
        expect(ready.status).toBe('completed');
        expect(ready.analysis.notes.detailed).toHaveLength(6);
        if (mode === 'valid')
          expect(ready.analysis.diagrams[0].title).toBe('Focused source diagram');
        else {
          expect(ready.analysis.diagrams).toEqual([]);
          expect(ready.analysis.warnings.join(' ')).toContain('omitted');
        }
        expect(calls - before).toBe(mode === 'budget' ? 1 : 2);
      }
    } finally {
      largeGeneration = false;
      invalidRefinement = false;
      service.config.jobCalls = previousBudget;
    }
  });
  it('rejects stale changes and invalid AI references before rendering', async () => {
    const g = await guest(),
      s = await create(g),
      ready = await done(g, s.id);
    const patch = (body: unknown) =>
      fetch(base + `/api/learning/${s.id}`, {
        method: 'PATCH',
        headers: { ...headers(g), 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
    expect((await patch({ title: 'Renamed lesson', revision: ready.revision })).status).toBe(200);
    expect((await patch({ title: 'Stale edit', revision: ready.revision })).status).toBe(409);
    const a = testAnalysis();
    a.diagrams[0].edges[0].evidence = ['missing'];
    expect((await patch({ analysis: a, revision: ready.revision + 1 })).status).toBe(400);
  });
  it('persists grounded tutor history, generates practice and records actual choice scores', async () => {
    const g = await guest(),
      s = await create(g);
    await done(g, s.id);
    const action = async (name: string, body: unknown) =>
      fetch(base + `/api/learning/${s.id}/${name}`, {
        method: 'POST',
        headers: { ...headers(g), 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
    const chat = await action('chat', { question: 'Who sends the request?', diagram: false });
    expect(chat.status).toBe(200);
    expect((await chat.json()).chat).toHaveLength(1);
    expect((await action('questions', { count: 1, difficulty: 'easy' })).status).toBe(200);
    const quiz = await action('quiz', { answers: { q1: 'Client' } });
    expect(quiz.status).toBe(200);
    expect((await quiz.json()).quizAttempts[0]).toMatchObject({ correct: 1, total: 1 });
    expect((await action('quiz', { answers: { missing: 'fake' } })).status).toBe(400);
  });
  it('cancels queued drafts and deletes owner-scoped sessions', async () => {
    const g = await guest(),
      s = await create(g, false);
    expect(
      (await fetch(base + `/api/learning/${s.id}`, { method: 'DELETE', headers: headers(g) }))
        .status,
    ).toBe(204);
    expect((await get(g, s.id)).status).toBe(404);
  });
  it('counts one corrective generation and fails safely after a second invalid result', async () => {
    try {
      const g = await guest();
      invalidGeneration = 'once';
      const before = calls,
        first = await create(g);
      expect((await done(g, first.id)).status).toBe('completed');
      expect(calls - before).toBe(2);
      const tasks = store.db
        .prepare('SELECT task FROM learning_calls WHERE session=? ORDER BY id')
        .all(first.id);
      expect(tasks.map((x) => x.task)).toEqual(['analysis', 'analysis:repair']);
      invalidGeneration = 'always';
      const next = calls,
        second = await create(g);
      const failed = await done(g, second.id);
      expect(failed.status).toBe('failed');
      expect(failed.analysis).toBeNull();
      expect(calls - next).toBe(2);
    } finally {
      invalidGeneration = 'none';
    }
  });
  it('validates source references again after a corrective generation', async () => {
    try {
      const g = await guest();
      invalidGeneration = 'ungrounded-once';
      const before = calls;
      const first = await create(g);
      expect((await done(g, first.id)).status).toBe('completed');
      expect(calls - before).toBe(2);
      invalidGeneration = 'ungrounded-always';
      const next = calls;
      const second = await create(g);
      const failed = await done(g, second.id);
      expect(failed.status).toBe('failed');
      expect(failed.analysis).toBeNull();
      expect(calls - next).toBe(2);
    } finally {
      invalidGeneration = 'none';
    }
  });
  it('makes Gemini structural correction explicit and never loops after invalid correction', async () => {
    const previousProvider = service.config.provider;
    const previousRepair = service.config.geminiRepairInvalidJSON;
    const previousKey = service.config.geminiKey;
    try {
      service.config.provider = 'gemini';
      service.config.geminiKey = 'test-only-key';
      const g = await guest();
      for (const [enabled, invalid, expectedCalls, expectedStatus] of [
        [false, 'once', 1, 'failed'],
        [true, 'once', 2, 'completed'],
        [true, 'always', 2, 'failed'],
        [true, 'ungrounded-always', 2, 'failed'],
      ] as const) {
        service.config.geminiRepairInvalidJSON = enabled;
        invalidGeneration = invalid;
        const before = calls;
        const session = await create(g);
        const result = await done(g, session.id);
        expect(result.status).toBe(expectedStatus);
        expect(calls - before).toBe(expectedCalls);
        if (expectedStatus === 'failed') expect(result.analysis).toBeNull();
      }
    } finally {
      service.config.provider = previousProvider;
      service.config.geminiKey = previousKey;
      service.config.geminiRepairInvalidJSON = previousRepair;
      invalidGeneration = 'none';
    }
  });
  it('does not exceed the per-job call budget for corrective generation', async () => {
    const previousBudget = service.config.jobCalls;
    try {
      service.config.jobCalls = 1;
      invalidGeneration = 'once';
      const g = await guest(),
        before = calls;
      const session = await create(g);
      const failed = await done(g, session.id);
      expect(failed.status).toBe('failed');
      expect(failed.analysis).toBeNull();
      expect(calls - before).toBe(1);
      const tasks = store.db
        .prepare('SELECT task FROM learning_calls WHERE session=?')
        .all(session.id);
      expect(tasks).toHaveLength(1);
    } finally {
      service.config.jobCalls = previousBudget;
      invalidGeneration = 'none';
    }
  });
  it('preserves drafts and blocks processing and tutoring without provider calls during cooldown', async () => {
    const g = await guest(),
      ready = await create(g);
    await done(g, ready.id);
    const draft = await create(g, false),
      before = calls;
    const key = service.config.provider + ':' + service.config.model;
    const retryAt = Date.now() + 3600_000;
    service.store.blockProvider(key, { retryAt, dailyQuota: true, freeTier: true });
    const config = await (await fetch(base + '/api/learning/config')).json();
    expect(
      (
        await fetch(base + `/api/learning/${ready.id}/process`, {
          method: 'POST',
          headers: headers(g),
        })
      ).status,
    ).toBe(200);
    expect(config).toMatchObject({
      available: false,
      retryAt: new Date(retryAt).toISOString(),
      unavailableReason: 'The free daily AI limit has been reached.',
    });
    for (const [id, name, body] of [
      [draft.id, 'process', {}],
      [ready.id, 'chat', { question: 'Who sends requests?', diagram: false }],
      [ready.id, 'questions', { count: 1, difficulty: 'easy' }],
    ] as const) {
      const response = await fetch(base + `/api/learning/${id}/${name}`, {
        method: 'POST',
        headers: { ...headers(g), 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      expect(response.status).toBe(429);
      expect((await response.json()).retryAt).toBe(new Date(retryAt).toISOString());
    }
    expect((await (await get(g, draft.id)).json()).status).toBe('draft');
    expect(calls).toBe(before);
    const other = await create(g, false);
    expect((await get(g, other.id)).status).toBe(200);
    service.store.blockProvider('expired:model', {
      retryAt: Date.now() - 1,
      dailyQuota: false,
      freeTier: false,
    });
    expect(service.store.cooldown('expired:model')).toBeNull();
  });
});
