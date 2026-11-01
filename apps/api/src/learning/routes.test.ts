import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Server } from 'node:http';
import { createApp } from '../app';
import { Store } from '../store';
import { aiConfig } from '../ai/config';
import type { AIProvider, Generation } from '../ai/providers';
import { LearningService } from './service';
import { testAnalysis } from '../../../../packages/core/src/study.test-support';
const origin = 'http://127.0.0.1:5173';
let server: Server, base: string, dir: string, service: LearningService;
const store = new Store(':memory:');
let calls = 0;
// Dependency injection is confined to this test. No mock provider exists in runtime code.
const provider: AIProvider = {
  name: 'test-only',
  async generate(r: Generation) {
    calls++;
    if (r.name === 'study_tutor')
      return {
        answer: 'The client sends the request.',
        evidence: ['text0'],
        additionalExplanation: false,
        uncertain: false,
        diagram: null,
      };
    if (r.name === 'practice_questions') return { questions: testAnalysis().questions };
    return testAnalysis();
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
        openaiKey: 'test-only-key',
        provider: 'openai',
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
