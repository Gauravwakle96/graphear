import { resolve } from 'node:path';
export type AIConfig = {
  provider: 'openai' | 'gemini' | 'compatible';
  openaiKey: string;
  geminiKey: string;
  compatibleKey: string;
  compatibleName: string;
  compatibleBaseURL: string;
  compatibleAPI: 'responses' | 'chat';
  compatibleVisionModel: string;
  compatibleOutputTokens: number;
  compatibleStructuredOutput: 'json_schema' | 'json_object';
  compatibleRepairInvalidJSON: boolean;
  model: string;
  transcriptionModel: string;
  geminiThinkingBudget?: number;
  geminiRepairInvalidJSON: boolean;
  freeTier: boolean;
  timeoutMs: number;
  dailyCalls: number;
  jobCalls: number;
  uploadBytes: number;
  mediaSeconds: number;
  youtubeSeconds: number;
  retentionHours: number;
  uploadDir: string;
  ffmpeg: string;
  ffprobe: string;
  youtubeOAuth: string;
  youtubeKey: string;
};
function limit(name: string, fallback: number, min: number, max: number) {
  const n = Number(process.env[name] ?? fallback);
  if (!Number.isFinite(n) || n < min || n > max)
    throw new Error(`${name} is outside its allowed range`);
  return Math.floor(n);
}
export function aiConfig(): AIConfig {
  const provider = process.env.AI_PROVIDER ?? 'openai';
  if (!['openai', 'gemini', 'compatible'].includes(provider))
    throw new Error('AI_PROVIDER must be openai, gemini or compatible');
  const compatibleAPI = process.env.COMPATIBLE_API ?? 'responses';
  if (!['responses', 'chat'].includes(compatibleAPI))
    throw new Error('COMPATIBLE_API must be responses or chat');
  const compatibleStructuredOutput = process.env.COMPATIBLE_STRUCTURED_OUTPUT ?? 'json_schema';
  if (!['json_schema', 'json_object'].includes(compatibleStructuredOutput))
    throw new Error('COMPATIBLE_STRUCTURED_OUTPUT must be json_schema or json_object');
  const compatibleBaseURL = providerBaseURL(
    process.env.COMPATIBLE_BASE_URL ?? 'http://127.0.0.1:31415/v1',
  );
  return {
    provider: provider as AIConfig['provider'],
    freeTier: process.env.AI_FREE_TIER === '1',
    openaiKey: process.env.OPENAI_API_KEY ?? '',
    geminiKey: process.env.GEMINI_API_KEY ?? '',
    compatibleKey: process.env.COMPATIBLE_API_KEY ?? '',
    compatibleName: process.env.COMPATIBLE_NAME?.trim().slice(0, 80) || 'AI gateway',
    compatibleBaseURL,
    compatibleAPI: compatibleAPI as AIConfig['compatibleAPI'],
    compatibleVisionModel: process.env.COMPATIBLE_VISION_MODEL?.trim() ?? '',
    compatibleOutputTokens: limit('COMPATIBLE_MAX_OUTPUT_TOKENS', 4096, 512, 16384),
    compatibleStructuredOutput:
      compatibleStructuredOutput as AIConfig['compatibleStructuredOutput'],
    compatibleRepairInvalidJSON: process.env.COMPATIBLE_REPAIR_INVALID_JSON === '1',
    model:
      provider === 'gemini'
        ? (process.env.GEMINI_MODEL ?? 'gemini-3.1-flash-lite')
        : provider === 'compatible'
          ? (process.env.COMPATIBLE_MODEL?.trim() ?? '')
          : (process.env.OPENAI_MODEL ?? 'gpt-6-astra'),
    transcriptionModel:
      provider === 'compatible'
        ? (process.env.COMPATIBLE_TRANSCRIPTION_MODEL?.trim() ?? '')
        : (process.env.OPENAI_TRANSCRIPTION_MODEL ?? 'gpt-transcribe'),
    geminiThinkingBudget: process.env.GEMINI_THINKING_BUDGET?.trim()
      ? limit('GEMINI_THINKING_BUDGET', 0, 0, 32768)
      : undefined,
    geminiRepairInvalidJSON: process.env.GEMINI_REPAIR_INVALID_JSON === '1',
    timeoutMs: limit('AI_TIMEOUT_SECONDS', 120, 10, 300) * 1000,
    dailyCalls: limit('AI_DAILY_CALL_LIMIT', 50, 1, 1000),
    jobCalls: limit('AI_JOB_CALL_LIMIT', 12, 1, 30),
    uploadBytes: limit('LEARNING_UPLOAD_MB', 100, 1, 200) * 1024 * 1024,
    mediaSeconds: limit('LEARNING_MEDIA_MINUTES', 30, 1, 120) * 60,
    youtubeSeconds: limit('LEARNING_YOUTUBE_MINUTES', 30, 1, 60) * 60,
    retentionHours: limit('LEARNING_RETENTION_HOURS', 168, 1, 8760),
    uploadDir: resolve(process.env.LEARNING_UPLOAD_DIR ?? 'data/learning'),
    ffmpeg: process.env.FFMPEG_PATH ?? 'ffmpeg',
    ffprobe: process.env.FFPROBE_PATH ?? 'ffprobe',
    youtubeOAuth: process.env.YOUTUBE_OAUTH_TOKEN ?? '',
    youtubeKey: process.env.YOUTUBE_API_KEY ?? '',
  };
}
export const configured = (c: AIConfig) =>
  Boolean(
    c.provider === 'compatible'
      ? c.compatibleKey && c.model
      : c.provider === 'openai'
        ? c.openaiKey
        : c.geminiKey,
  );

export function providerBaseURL(value: string) {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error('COMPATIBLE_BASE_URL must be a valid API URL');
  }
  const loopback = ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname);
  if (
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    !(url.protocol === 'https:' || (url.protocol === 'http:' && loopback))
  )
    throw new Error(
      'COMPATIBLE_BASE_URL requires HTTPS or HTTP on loopback, without credentials or query parameters',
    );
  return url.toString().replace(/\/+$/, '');
}
