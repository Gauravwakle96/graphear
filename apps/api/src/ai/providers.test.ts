import { describe, it, expect, vi, afterEach } from 'vitest';
import { z } from 'zod';
import { AIQuotaError, OpenAIProvider, GeminiProvider } from './providers';
import { aiConfig } from './config';
const schema = z.object({ answer: z.string() }).strict();
afterEach(() => vi.unstubAllGlobals());
describe('documented HTTP provider contracts (test responses only)', () => {
  it('extracts a safe free-quota reset time without exposing provider details', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        Response.json(
          {
            error: {
              message: 'private account details',
              details: [
                { retryDelay: '3600s' },
                {
                  violations: [
                    {
                      quotaId: 'GenerateRequestsPerDayPerProjectPerModel-FreeTier',
                      quotaSubject: 'private',
                    },
                  ],
                },
              ],
            },
          },
          { status: 429 },
        ),
      ),
    );
    const before = Date.now();
    const error = await new GeminiProvider({ ...aiConfig(), provider: 'gemini' })
      .generate({
        instruction: '',
        context: '',
        schema,
        name: 'test',
        signal: AbortSignal.timeout(1000),
      })
      .catch((e) => e);
    expect(error).toBeInstanceOf(AIQuotaError);
    if (!(error instanceof AIQuotaError)) throw new Error('Expected an AI quota error');
    expect(error).toMatchObject({ dailyQuota: true, freeTier: true });
    expect(error.retryAt).toBeGreaterThanOrEqual(before + 3600_000);
    expect(error.message).toBe('The free daily AI limit has been reached.');
    expect(error.message).not.toContain('private');
  });
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
  it('sends Gemini inline images and JSON schemas through generateContent', async () => {
    let request: Record<string, unknown> = {};
    let endpoint = '';
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url, init) => {
        request = JSON.parse(init.body);
        endpoint = String(_url);
        return Response.json({
          candidates: [{ finishReason: 'STOP', content: { parts: [{ text: '{"answer":"ok"}' }] } }],
        });
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
    expect(endpoint).toContain(':generateContent');
    expect(request.generationConfig).toMatchObject({ responseMimeType: 'application/json' });
    expect(request.generationConfig).toMatchObject({
      responseSchema: { type: 'OBJECT', required: ['answer'] },
    });
    expect(JSON.stringify(request)).toContain('inlineData');
    expect(JSON.stringify(request)).not.toContain('test-only-key');
  });
  it('rejects blocked and truncated Gemini output and transcribes inline audio', async () => {
    const provider = new GeminiProvider({
      ...aiConfig(),
      provider: 'gemini',
      geminiKey: 'test-only-key',
    });
    for (const response of [
      Response.json({ promptFeedback: { blockReason: 'SAFETY' } }),
      Response.json({
        candidates: [
          { finishReason: 'MAX_TOKENS', content: { parts: [{ text: '{"answer":"partial"}' }] } },
        ],
      }),
    ]) {
      vi.stubGlobal(
        'fetch',
        vi.fn(async () => response),
      );
      await expect(
        provider.generate({
          instruction: '',
          context: '',
          schema,
          name: 'test',
          signal: AbortSignal.timeout(1000),
        }),
      ).rejects.toThrow();
    }
    let request: Record<string, unknown> = {};
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url, init) => {
        request = JSON.parse(init.body);
        return Response.json({
          candidates: [
            {
              finishReason: 'STOP',
              content: { parts: [{ text: '{"text":"The client sends a request."}' }] },
            },
          ],
        });
      }),
    );
    expect(
      await provider.transcribe(new Uint8Array([1, 2]), 'audio/wav', AbortSignal.timeout(1000)),
    ).toBe('The client sends a request.');
    expect(JSON.stringify(request)).toContain('audio/wav');
  });
  it('handles refusal, invalid JSON, API quota and incomplete output without fabricating content', async () => {
    for (const response of [
      Response.json({ output: [{ content: [{ type: 'refusal' }] }] }),
      Response.json({ output_text: 'not JSON' }),
      Response.json({ error: 'private provider detail' }, { status: 429 }),
      Response.json({ error: 'private provider detail' }, { status: 503 }),
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
