import { describe, it, expect, vi, afterEach } from 'vitest';
import { z } from 'zod';
import { OpenAIProvider, GeminiProvider } from './providers';
import { aiConfig } from './config';
const schema = z.object({ answer: z.string() }).strict();
afterEach(() => vi.unstubAllGlobals());
describe('documented HTTP provider contracts (test responses only)', () => {
  it('sends OpenAI vision and strict output schemas using server-only authentication', async () => {
    let request: Record<string, unknown> = {};
    let headers: HeadersInit | undefined;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url, init) => {
        request = JSON.parse(init.body);
        headers = init.headers;
        return Response.json({
          output: [
            { type: 'message', content: [{ type: 'output_text', text: '{"answer":"ok"}' }] },
          ],
        });
      }),
    );
    const p = new OpenAIProvider({ ...aiConfig(), openaiKey: 'test-only-not-a-real-key' });
    expect(
      await p.generate({
        instruction: 'system',
        context: 'source',
        images: [{ mime: 'image/png', data: 'test' }],
        schema,
        name: 'test',
        signal: AbortSignal.timeout(1000),
      }),
    ).toEqual({ answer: 'ok' });
    expect(request.store).toBe(false);
    expect(JSON.stringify(request)).not.toContain('test-only-not-a-real-key');
    expect(new Headers(headers).get('Authorization')).toMatch(/^Bearer /);
    expect(JSON.stringify(request)).toContain('input_image');
  });
  it('sends Gemini inline images and handles output_text', async () => {
    let request: Record<string, unknown> = {};
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url, init) => {
        request = JSON.parse(init.body);
        return Response.json({ output_text: '{"answer":"ok"}' });
      }),
    );
    const p = new GeminiProvider({ ...aiConfig(), provider: 'gemini', geminiKey: 'test-only-key' });
    expect(
      await p.generate({
        instruction: 'system',
        context: 'source',
        schema,
        name: 'test',
        images: [{ mime: 'image/jpeg', data: 'base64' }],
        signal: AbortSignal.timeout(1000),
      }),
    ).toEqual({ answer: 'ok' });
    expect(request.response_format).toMatchObject({ type: 'text', mime_type: 'application/json' });
    expect(JSON.stringify(request)).toContain('mime_type');
    expect(request.store).toBe(false);
  });
  it('handles refusal, invalid JSON, API quota and incomplete output without fabricating content', async () => {
    for (const response of [
      Response.json({ output: [{ content: [{ type: 'refusal' }] }] }),
      Response.json({ output_text: 'not JSON' }),
      Response.json({ error: 'private provider detail' }, { status: 429 }),
      Response.json({ status: 'incomplete' }),
    ]) {
      vi.stubGlobal(
        'fetch',
        vi.fn(async () => response),
      );
      await expect(
        new OpenAIProvider(aiConfig()).generate({
          instruction: '',
          context: '',
          schema,
          name: 'test',
          signal: AbortSignal.timeout(1000),
        }),
      ).rejects.toThrow();
    }
  });
  it('sends actual multipart audio transcription and validates returned text', async () => {
    let body: FormData | undefined;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url, init) => {
        body = init.body;
        return Response.json({ text: 'Test transcription' });
      }),
    );
    expect(
      await new OpenAIProvider(aiConfig()).transcribe(
        new Uint8Array([1, 2]),
        'audio/wav',
        AbortSignal.timeout(1000),
      ),
    ).toBe('Test transcription');
    expect(body?.get('file')).toBeInstanceOf(Blob);
  });
});
