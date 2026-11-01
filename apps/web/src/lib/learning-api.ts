import { z } from 'zod';
import {
  analysisSchema,
  sourceSchema,
  optionsSchema,
  tutorSchema,
  validateAnalysis,
} from '@graphear/core';
import { apiRequest, ensureSession, workspaceHeaders } from './api';
const sessionSchema = z.object({
  id: z.uuid(),
  title: z.string().max(180),
  status: z.enum([
    'draft',
    'queued',
    'extracting',
    'generating',
    'completed',
    'failed',
    'cancelled',
  ]),
  progress: z.number(),
  message: z.string(),
  error: z.string().nullable(),
  revision: z.number(),
  createdAt: z.string(),
  updatedAt: z.string(),
  assetExpiresAt: z.number(),
  input: z.object({
    kind: z.enum(['file', 'text', 'youtube']),
    name: z.string(),
    mime: z.string().nullable(),
    text: z.string(),
    url: z.string().nullable(),
    videoId: z.string().nullable(),
    duration: z.number().nullable(),
    embed: z.boolean(),
  }),
  options: optionsSchema,
  sources: z.array(sourceSchema),
  analysis: analysisSchema.nullable(),
  chat: z.array(
    z.object({ id: z.string(), question: z.string(), result: tutorSchema, createdAt: z.string() }),
  ),
  hasFile: z.boolean(),
  fileUrl: z.string().nullable(),
  quizAttempts: z
    .array(
      z.object({
        id: z.string(),
        createdAt: z.string(),
        correct: z.number(),
        total: z.number(),
        answers: z.record(z.string(), z.string()),
      }),
    )
    .default([]),
});
export type LearningSession = z.infer<typeof sessionSchema>;
export type LearningSummary = Pick<
  LearningSession,
  'id' | 'title' | 'status' | 'progress' | 'updatedAt' | 'revision'
>;
export type LearningConfig = {
  provider: string;
  model: string;
  configured: boolean;
  available: boolean;
  freeTier: boolean;
  retryAt: string | null;
  unavailableReason: string | null;
  captionsConfigured: boolean;
  limits: {
    uploadMB: number;
    documentMB: number;
    mediaMinutes: number;
    pdfPages: number;
    retentionHours: number;
  };
  privacy: string;
};
function parse(value: unknown) {
  const session = sessionSchema.parse(value);
  if (session.analysis) {
    const checked = validateAnalysis(session.analysis, session.sources);
    for (const d of checked.diagrams)
      d.reviewed = Boolean(session.analysis.diagrams.find((v) => v.id === d.id)?.reviewed);
    session.analysis = checked;
  }
  if (session.fileUrl && !session.fileUrl.startsWith(`/api/learning/${session.id}/`))
    throw new Error('Invalid private source URL');
  for (const s of session.sources)
    if (s.asset && !s.asset.startsWith(`/api/learning/${session.id}/sources/`))
      throw new Error('Invalid source asset URL');
  return session;
}
export async function learningConfig() {
  return apiRequest<LearningConfig>('/learning/config');
}
export async function learningList() {
  await ensureSession();
  return (await apiRequest<{ sessions: LearningSummary[] }>('/learning')).sessions;
}
export async function learningGet(id: string) {
  await ensureSession();
  return parse(await apiRequest(`/learning/${encodeURIComponent(id)}`));
}
export async function learningAction(id: string, action: string, body: unknown = {}) {
  await ensureSession();
  return parse(
    await apiRequest(`/learning/${id}/${action}`, {
      method: 'POST',
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(310_000),
    }),
  );
}
export async function learningSave(s: LearningSession) {
  await ensureSession();
  return parse(
    await apiRequest(`/learning/${s.id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        title: s.title,
        analysis: s.analysis ?? undefined,
        revision: s.revision,
      }),
    }),
  );
}
export async function learningDelete(id: string) {
  await ensureSession();
  return apiRequest<void>(`/learning/${id}`, {
    method: 'DELETE',
    signal: AbortSignal.timeout(310_000),
  });
}
export async function learningUpload(form: FormData, progress: (n: number) => void) {
  await ensureSession();
  return new Promise<LearningSession>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/learning');
    xhr.timeout = 180_000;
    for (const [k, v] of Object.entries(workspaceHeaders())) xhr.setRequestHeader(k, v);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) progress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onerror = () => reject(new Error('Upload failed. Check your connection and try again.'));
    xhr.ontimeout = () =>
      reject(new Error('Upload timed out. Check saved sessions before retrying.'));
    xhr.onload = () => {
      try {
        const data = JSON.parse(xhr.responseText);
        if (xhr.status < 200 || xhr.status >= 300)
          throw new Error(data.error ?? 'Upload could not be completed');
        resolve(parse(data));
      } catch (e) {
        reject(e);
      }
    };
    xhr.send(form);
  });
}
export async function learningExport(id: string, format: string, style: string) {
  await ensureSession();
  const response = await fetch(`/api/learning/${id}/export/${format}?style=${style}`, {
    credentials: 'same-origin',
    signal: AbortSignal.timeout(60_000),
  });
  if (!response.ok) {
    const result = await response.json().catch(() => ({ error: 'Export failed' }));
    throw new Error(result.error ?? 'Export failed');
  }
  return response.blob();
}
