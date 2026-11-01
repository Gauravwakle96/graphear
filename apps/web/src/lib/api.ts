import { parseGraph, type Graph } from '@graphear/core';
export type RemoteDiagram = {
  id: string;
  graph: Graph;
  revision: number;
  updatedAt: string;
  shareToken?: string;
};
export type RemoteSummary = {
  id: string;
  title: string;
  description: string;
  steps: number;
  connections: number;
  revision: number;
  updatedAt: string;
  shareToken?: string;
};
let csrfToken = '';
let sessionPromise: Promise<void> | null = null;
async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`/api${path}`, {
    ...init,
    credentials: 'same-origin',
    headers: {
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...(init.method && init.method !== 'GET' ? { 'X-CSRF-Token': csrfToken } : {}),
      ...init.headers,
    },
    signal: AbortSignal.timeout(12_000),
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => ({
      error: 'The private workspace is unavailable. You can save on this device instead.',
    }))) as { error?: string };
    throw new Error(body.error ?? 'The workspace could not complete this request.');
  }
  return response.status === 204 ? (undefined as T) : (response.json() as Promise<T>);
}
export async function ensureSession() {
  if (csrfToken) return;
  if (!sessionPromise)
    sessionPromise = request<{ csrfToken: string }>('/session', { method: 'POST' })
      .then((result) => {
        csrfToken = result.csrfToken;
      })
      .finally(() => {
        sessionPromise = null;
      });
  return sessionPromise;
}
export async function listRemote() {
  await ensureSession();
  return (await request<{ projects: RemoteSummary[] }>('/projects')).projects;
}
export async function getRemote(id: string) {
  await ensureSession();
  const result = await request<RemoteDiagram>(`/projects/${encodeURIComponent(id)}`);
  return { ...result, graph: parseGraph(result.graph) };
}
export async function saveRemote(graph: Graph, existing?: { id: string; revision: number }) {
  await ensureSession();
  const result = await request<RemoteDiagram>(existing ? `/projects/${existing.id}` : '/projects', {
    method: existing ? 'PUT' : 'POST',
    body: JSON.stringify({ graph, ...(existing ? { revision: existing.revision } : {}) }),
  });
  return { ...result, graph: parseGraph(result.graph) };
}
export async function deleteRemote(id: string) {
  await ensureSession();
  return request<void>(`/projects/${encodeURIComponent(id)}`, { method: 'DELETE' });
}
export async function publishRemote(id: string) {
  await ensureSession();
  return request<{ token: string; url: string }>(`/projects/${encodeURIComponent(id)}/share`, {
    method: 'POST',
  });
}
export async function revokeRemote(id: string) {
  await ensureSession();
  return request<void>(`/projects/${encodeURIComponent(id)}/share`, { method: 'DELETE' });
}
export async function getShared(token: string) {
  const result = await request<{ graph: Graph; publishedAt: string }>(
    `/shares/${encodeURIComponent(token)}`,
  );
  return { ...result, graph: parseGraph(result.graph) };
}
