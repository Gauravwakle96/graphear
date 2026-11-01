import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { Server } from 'node:http';
import { createApp } from './app';
import { Store } from './store';
import { scholarshipGraph } from '@graphear/core';
const origin = 'http://127.0.0.1:5173';
let server: Server;
let base: string;
const store = new Store(':memory:');
type Guest = { cookie: string; csrf: string };
async function guest(): Promise<Guest> {
  const res = await fetch(`${base}/api/session`, { method: 'POST', headers: { Origin: origin } });
  const body = (await res.json()) as { csrfToken: string };
  return { cookie: res.headers.get('set-cookie')!.split(';')[0], csrf: body.csrfToken };
}
function headers(g: Guest) {
  return {
    'Content-Type': 'application/json',
    Origin: origin,
    Cookie: g.cookie,
    'X-CSRF-Token': g.csrf,
  };
}
beforeAll(async () => {
  server = createApp(store).listen(0, '127.0.0.1');
  await new Promise<void>((r) => server.once('listening', r));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('No server address');
  base = `http://127.0.0.1:${address.port}`;
});
afterAll(async () => {
  await new Promise<void>((r) => server.close(() => r()));
  store.close();
});
describe('private workspace API', () => {
  it('requires a session for private projects', async () =>
    expect((await fetch(`${base}/api/projects`)).status).toBe(401));
  it('refuses foreign origins during session creation', async () =>
    expect(
      (
        await fetch(`${base}/api/session`, {
          method: 'POST',
          headers: { Origin: 'https://evil.example' },
        })
      ).status,
    ).toBe(403));
  it('sets an HttpOnly SameSite session cookie', async () => {
    const res = await fetch(`${base}/api/session`, { method: 'POST', headers: { Origin: origin } });
    expect(res.headers.get('set-cookie')).toMatch(/HttpOnly; SameSite=Strict/);
  });
  it('blocks a mutation without CSRF', async () => {
    const g = await guest();
    const res = await fetch(`${base}/api/projects`, {
      method: 'POST',
      headers: { ...headers(g), 'X-CSRF-Token': '' },
      body: JSON.stringify({ graph: scholarshipGraph }),
    });
    expect(res.status).toBe(403);
  });
  it('saves, lists and reads a graph', async () => {
    const g = await guest();
    const res = await fetch(`${base}/api/projects`, {
      method: 'POST',
      headers: headers(g),
      body: JSON.stringify({ graph: scholarshipGraph }),
    });
    expect(res.status).toBe(201);
    const p = (await res.json()) as { id: string };
    const list = (await (await fetch(`${base}/api/projects`, { headers: headers(g) })).json()) as {
      projects: unknown[];
    };
    expect(list.projects.length).toBe(1);
    const loaded = (await (
      await fetch(`${base}/api/projects/${p.id}`, { headers: headers(g) })
    ).json()) as { graph: unknown };
    expect(loaded.graph).toEqual(scholarshipGraph);
  });
  it('prevents another guest reading, editing and deleting a project', async () => {
    const a = await guest(),
      b = await guest();
    const p = (await (
      await fetch(`${base}/api/projects`, {
        method: 'POST',
        headers: headers(a),
        body: JSON.stringify({ graph: scholarshipGraph }),
      })
    ).json()) as { id: string };
    for (const method of ['GET', 'PUT', 'DELETE']) {
      const res = await fetch(`${base}/api/projects/${p.id}`, {
        method,
        headers: headers(b),
        ...(method === 'PUT'
          ? { body: JSON.stringify({ graph: scholarshipGraph, revision: 1 }) }
          : {}),
      });
      expect(res.status).toBe(404);
    }
  });
  it('rejects stale updates', async () => {
    const g = await guest();
    const p = (await (
      await fetch(`${base}/api/projects`, {
        method: 'POST',
        headers: headers(g),
        body: JSON.stringify({ graph: scholarshipGraph }),
      })
    ).json()) as { id: string };
    const request = () =>
      fetch(`${base}/api/projects/${p.id}`, {
        method: 'PUT',
        headers: headers(g),
        body: JSON.stringify({ graph: scholarshipGraph, revision: 1 }),
      });
    expect((await request()).status).toBe(200);
    expect((await request()).status).toBe(409);
  });
  it('rejects malformed graph references', async () => {
    const g = await guest();
    const graph = structuredClone(scholarshipGraph);
    graph.edges[0].target = 'missing';
    const res = await fetch(`${base}/api/projects`, {
      method: 'POST',
      headers: headers(g),
      body: JSON.stringify({ graph }),
    });
    expect(res.status).toBe(400);
  });
  it('shares only an explicit snapshot and revokes it', async () => {
    const g = await guest();
    const p = (await (
      await fetch(`${base}/api/projects`, {
        method: 'POST',
        headers: headers(g),
        body: JSON.stringify({ graph: scholarshipGraph }),
      })
    ).json()) as { id: string };
    const shared = (await (
      await fetch(`${base}/api/projects/${p.id}/share`, { method: 'POST', headers: headers(g) })
    ).json()) as { token: string };
    const publicRes = await fetch(`${base}/api/shares/${shared.token}`);
    expect(publicRes.status).toBe(200);
    const body = (await publicRes.json()) as Record<string, unknown>;
    expect(body.owner).toBeUndefined();
    await fetch(`${base}/api/projects/${p.id}/share`, { method: 'DELETE', headers: headers(g) });
    expect((await fetch(`${base}/api/shares/${shared.token}`)).status).toBe(404);
  });
  it('blocks publishing unreviewed structure', async () => {
    const g = await guest();
    const graph = structuredClone(scholarshipGraph);
    graph.edges[0].review = 'inferred';
    const p = (await (
      await fetch(`${base}/api/projects`, {
        method: 'POST',
        headers: headers(g),
        body: JSON.stringify({ graph }),
      })
    ).json()) as { id: string };
    expect(
      (await fetch(`${base}/api/projects/${p.id}/share`, { method: 'POST', headers: headers(g) }))
        .status,
    ).toBe(422);
  });
  it('returns deterministic analysis', async () => {
    const g = await guest();
    const res = await fetch(`${base}/api/graphs/analyze`, {
      method: 'POST',
      headers: headers(g),
      body: JSON.stringify({ graph: scholarshipGraph }),
    });
    const body = (await res.json()) as { analysis: { reachableOutcomes: string[] } };
    expect(body.analysis.reachableOutcomes).toContain('approved');
  });
  it('rejects oversized JSON', async () => {
    const g = await guest();
    const res = await fetch(`${base}/api/projects`, {
      method: 'POST',
      headers: headers(g),
      body: JSON.stringify({ data: 'x'.repeat(1_100_000) }),
    });
    expect(res.status).toBe(413);
  });
});
