import { describe, it, expect, vi, afterEach } from 'vitest';
import { youtubeId, parseCaptions, youtubeCaptions, transcriptSources } from './youtube';
import { aiConfig } from '../ai/config';
afterEach(() => vi.unstubAllGlobals());
describe('permitted YouTube ingestion', () => {
  it('retains pasted transcript timestamps and does not invent absent times', () => {
    const sources = transcriptSources('0:01\nA client sends a request.\n1:40\nThe server replies.');
    expect(sources.map((s) => s.start)).toEqual([1, 100]);
    expect(sources.every((s) => s.end === null)).toBe(true);
    expect(transcriptSources('A client sends a request.')[0].start).toBeNull();
    expect(() => transcriptSources('1:40\nFirst.\n0:01\nSecond.')).toThrow(/increasing/);
  });
  it('accepts public YouTube forms and rejects arbitrary hosts and private credentials', () => {
    expect(youtubeId('https://youtu.be/abcdefghijk')).toBe('abcdefghijk');
    expect(youtubeId('https://www.youtube.com/watch?v=abcdefghijk')).toBe('abcdefghijk');
    for (const s of [
      'http://youtube.com/watch?v=abcdefghijk',
      'https://youtube.com.evil.example/watch?v=abcdefghijk',
      'https://user:password@youtube.com/watch?v=abcdefghijk',
      'https://127.0.0.1/watch?v=abcdefghijk',
    ])
      expect(() => youtubeId(s)).toThrow();
  });
  it('retains genuine caption intervals instead of invented timestamps', () => {
    const sources = parseCaptions(
      'WEBVTT\n\n00:00:01.000 --> 00:00:05.000\nClient sends request\n\n00:01:40.000 --> 00:01:44.000\nServer responds',
    );
    expect(sources).toHaveLength(2);
    expect(sources[1].start).toBe(100);
    expect(sources[1].text).toBe('Server responds');
  });
  it('fails explicitly without rights and never attempts restricted audio downloads', async () => {
    const request = vi.fn();
    vi.stubGlobal('fetch', request);
    await expect(
      youtubeCaptions(
        'abcdefghijk',
        { ...aiConfig(), youtubeOAuth: '' },
        AbortSignal.timeout(1000),
      ),
    ).rejects.toThrow(/OAuth/);
    expect(request).not.toHaveBeenCalled();
  });
  it('uses only the official list/download endpoints with authorized OAuth', async () => {
    const request = vi.fn(async (url: string) =>
      url.includes('?part=')
        ? Response.json({ items: [{ id: 'authorized-track', snippet: { language: 'en' } }] })
        : new Response('WEBVTT\n\n00:00:01.000 --> 00:00:03.000\nClient request'),
    );
    vi.stubGlobal('fetch', request);
    expect(
      await youtubeCaptions(
        'abcdefghijk',
        { ...aiConfig(), youtubeOAuth: 'test-only' },
        AbortSignal.timeout(1000),
      ),
    ).toHaveLength(1);
    expect(
      request.mock.calls.every(([url]) =>
        url.startsWith('https://www.googleapis.com/youtube/v3/captions'),
      ),
    ).toBe(true);
  });
});
