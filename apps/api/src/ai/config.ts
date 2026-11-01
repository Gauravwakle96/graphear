import { resolve } from 'node:path';
export type AIConfig = {
  provider: 'openai' | 'gemini';
  openaiKey: string;
  geminiKey: string;
  model: string;
  transcriptionModel: string;
  geminiThinkingBudget?: number;
  freeTier: boolean;
  timeoutMs: number;
  dailyCalls: number;
  jobCalls: number;
  uploadBytes: number;
  mediaSeconds: number;
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
  if (!['openai', 'gemini'].includes(provider))
    throw new Error('AI_PROVIDER must be openai or gemini');
  return {
    provider: provider as AIConfig['provider'],
    freeTier: process.env.AI_FREE_TIER === '1',
    openaiKey: process.env.OPENAI_API_KEY ?? '',
    geminiKey: process.env.GEMINI_API_KEY ?? '',
    model:
      provider === 'gemini'
        ? (process.env.GEMINI_MODEL ?? 'gemini-3.8-flash')
        : (process.env.OPENAI_MODEL ?? 'gpt-6-astra'),
    transcriptionModel: process.env.OPENAI_TRANSCRIPTION_MODEL ?? 'gpt-transcribe',
    geminiThinkingBudget: process.env.GEMINI_THINKING_BUDGET?.trim()
      ? limit('GEMINI_THINKING_BUDGET', 0, 0, 32768)
      : undefined,
    timeoutMs: limit('AI_TIMEOUT_SECONDS', 120, 10, 300) * 1000,
    dailyCalls: limit('AI_DAILY_CALL_LIMIT', 50, 1, 1000),
    jobCalls: limit('AI_JOB_CALL_LIMIT', 12, 1, 30),
    uploadBytes: limit('LEARNING_UPLOAD_MB', 100, 1, 200) * 1024 * 1024,
    mediaSeconds: limit('LEARNING_MEDIA_MINUTES', 30, 1, 120) * 60,
    retentionHours: limit('LEARNING_RETENTION_HOURS', 168, 1, 8760),
    uploadDir: resolve(process.env.LEARNING_UPLOAD_DIR ?? 'data/learning'),
    ffmpeg: process.env.FFMPEG_PATH ?? 'ffmpeg',
    ffprobe: process.env.FFPROBE_PATH ?? 'ffprobe',
    youtubeOAuth: process.env.YOUTUBE_OAUTH_TOKEN ?? '',
    youtubeKey: process.env.YOUTUBE_API_KEY ?? '',
  };
}
export const configured = (c: AIConfig) =>
  Boolean(c.provider === 'openai' ? c.openaiKey : c.geminiKey);
