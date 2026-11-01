import { describe, it, expect, vi, afterEach } from 'vitest';
import { z } from 'zod';
import {
  AIQuotaError,
  OpenAIProvider,
  GeminiProvider,
  CompatibleProvider,
  makeProvider,
} from './providers';
import { aiConfig, configured, providerBaseURL } from './config';
const schema = z.object({ answer: z.string() }).strict();
afterEach(() => vi.unstubAllGlobals());
describe('documented HTTP provider contracts (test responses only)', () => {
  it('validates operator URLs and requires a model and key for compatible gateways', () => {
    for (const url of [
      'http://169.254.169.254/v1',
      'http://api.example.test/v1',
      'https://user:password@example.test/v1',
      'https://example.test/v1?key=secret',
      'file:///tmp/api',
    ])
      expect(() => providerBaseURL(url)).toThrow();
    expect(providerBaseURL('http://127.0.0.1:31415/v1/')).toBe('http://127.0.0.1:31415/v1');
    expect(providerBaseURL('https://gateway.example.test/v1')).toBe(
      'https://gateway.example.test/v1',
    );
    const config = {
      ...aiConfig(),
      provider: 'compatible' as const,
      compatibleKey: 'test-only',
      model: '',
    };
    expect(configured(config)).toBe(false);
    expect(configured({ ...config, model: 'text-model' })).toBe(true);
    expect(makeProvider(config)).toBeInstanceOf(CompatibleProvider);
  });
  it('respects a gateway absolute retry time without exposing its raw error', async () => {
    const retryAtMs = Date.now() + 180000;
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        Response.json(
          {
            error: { type: 'rate_limit_error', message: 'private account information', retryAtMs },
          },
          { status: 429 },
        ),
      ),
    );
    const provider = new CompatibleProvider({ ...aiConfig(), compatibleAPI: 'responses' });
    await expect(
      provider.generate({
        instruction: '',
        context: '',
        schema,
        name: 'test',
        signal: AbortSignal.timeout(1000),
      }),
    ).rejects.toMatchObject({ retryAt: retryAtMs });
  });
  it('routes compatible Responses vision to its explicit model with server-only credentials', async () => {
    const calls: { url: string; body: Record<string, unknown>; headers: Headers }[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url, init) => {
        calls.push({
          url: String(url),
          body: JSON.parse(init.body),
          headers: new Headers(init.headers),
        });
        expect(init.redirect).toBe('error');
        return Response.json({ output_text: '{"answer":"validated"}' });
      }),
    );
    const provider = new CompatibleProvider({
      ...aiConfig(),
      compatibleBaseURL: 'http://127.0.0.1:31415/v1',
      compatibleKey: 'test-only-local-key',
      compatibleAPI: 'responses',
      model: 'text-model',
      compatibleVisionModel: 'vision-model',
    });
    const request = {
      instruction: 'source rules',
      context: 'source',
      schema,
      name: 'test',
      signal: AbortSignal.timeout(1000),
    };
    expect(await provider.generate(request)).toEqual({ answer: 'validated' });
    expect(
      await provider.generate({ ...request, images: [{ mime: 'image/png', data: 'test' }] }),
    ).toEqual({ answer: 'validated' });
    expect(calls.map((c) => c.url)).toEqual([
      'http://127.0.0.1:31415/v1/responses',
      'http://127.0.0.1:31415/v1/responses',
    ]);
    expect(calls.map((c) => c.body.model)).toEqual(['text-model', 'vision-model']);
    expect(calls[1].headers.get('Authorization')).toBe('Bearer test-only-local-key');
    expect(calls[1].body.store).toBe(false);
    expect(calls[1].body.max_output_tokens).toBe(4096);
    expect(JSON.stringify(calls[1].body)).toContain('input_image');
    expect(JSON.stringify(calls[1].body)).not.toContain('test-only-local-key');
  });
  it('supports compatible Chat Completions and rejects incomplete and invalid structured content', async () => {
    const provider = new CompatibleProvider({
      ...aiConfig(),
      compatibleAPI: 'chat',
      model: 'text-model',
    });
    const request = {
      instruction: 'rules',
      context: 'source',
      schema,
      name: 'test',
      signal: AbortSignal.timeout(1000),
    };
    let body: Record<string, unknown> = {};
    let endpoint = '';
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url, init) => {
        endpoint = String(url);
        body = JSON.parse(init.body);
        return Response.json({
          choices: [{ finish_reason: 'stop', message: { content: '{"answer":"ok"}' } }],
        });
      }),
    );
    expect(await provider.generate(request)).toEqual({ answer: 'ok' });
    expect(endpoint).toMatch(/\/v1\/chat\/completions$/);
    expect(body.response_format).toMatchObject({
      type: 'json_schema',
      json_schema: { strict: true },
    });
    for (const [finish, text] of [
      ['length', '{"answer":"partial"}'],
      ['stop', '{"unknown":"invalid"}'],
    ]) {
      vi.stubGlobal(
        'fetch',
        vi.fn(async () =>
          Response.json({ choices: [{ finish_reason: finish, message: { content: text } }] }),
        ),
      );
      await expect(provider.generate(request)).rejects.toThrow();
    }
  });
  it('uses explicit JSON mode with the full prompt schema and rejects invalid generated values', async () => {
    const provider = new CompatibleProvider({
      ...aiConfig(),
      compatibleStructuredOutput: 'json_object',
      compatibleAPI: 'responses',
    });
    let body: Record<string, unknown> = {};
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url, init) => {
        body = JSON.parse(init.body);
        return Response.json({ output_text: '{"answer":"ok"}' });
      }),
    );
    const request = {
      instruction: 'Source rules',
      context: 'Source',
      schema,
      name: 'test',
      signal: AbortSignal.timeout(1000),
    };
    expect(await provider.generate(request)).toEqual({ answer: 'ok' });
    expect(body.text).toEqual({ format: { type: 'json_object' } });
    expect(String(body.instructions)).toContain('Source rules');
    expect(String(body.instructions)).toContain('"required":["answer"]');
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Response.json({ output_text: '{"unknown":"invalid"}' })),
    );
    await expect(provider.generate(request)).rejects.toThrow();
  });
  it('fails before a gateway call when vision or transcription is not configured', async () => {
    const fetcher = vi.fn();
    vi.stubGlobal('fetch', fetcher);
    const provider = new CompatibleProvider({
      ...aiConfig(),
      compatibleVisionModel: '',
      transcriptionModel: '',
    });
    await expect(
      provider.generate({
        instruction: '',
        context: '',
        images: [{ mime: 'image/png', data: 'test' }],
        schema,
        name: 'test',
        signal: AbortSignal.timeout(1000),
      }),
    ).rejects.toThrow(/vision model/);
    await expect(
      provider.transcribe(new Uint8Array([1]), 'audio/wav', AbortSignal.timeout(1000)),
    ).rejects.toThrow(/transcription is not configured/);
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('uses only the gateway transcription endpoint and gives a safe offline error', async () => {
    const provider = new CompatibleProvider({
      ...aiConfig(),
      compatibleKey: 'test-only-local-key',
      transcriptionModel: 'transcription-model',
    });
    let endpoint = '';
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url) => {
        endpoint = String(url);
        return Response.json({ text: 'A client sends a request.' });
      }),
    );
    expect(
      await provider.transcribe(new Uint8Array([1]), 'audio/wav', AbortSignal.timeout(1000)),
    ).toBe('A client sends a request.');
    expect(endpoint).toBe('http://127.0.0.1:31415/v1/audio/transcriptions');
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('private connection details');
      }),
    );
    await expect(
      provider.generate({
        instruction: '',
        context: '',
        schema,
        name: 'test',
        signal: AbortSignal.timeout(1000),
      }),
    ).rejects.toThrow(/gateway is unreachable/);
  });
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
