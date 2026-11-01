import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  youtubeId,
  parseCaptions,
  youtubeCaptions,
  transcriptSources,
  validateYoutubeObservations,
  youtubeMetadata,
  youtubeIntervals,
} from './youtube';
import { aiConfig } from '../ai/config';
afterEach(() => vi.unstubAllGlobals());
describe('permitted YouTube ingestion', () => {
  it('covers the entire bounded video with sequential intervals while reserving correction calls', () => {
    const intervals = youtubeIntervals(999, 12);
    expect(intervals).toEqual([
      { start: 0, end: 333 },
      { start: 333, end: 666 },
      { start: 666, end: 999 },
    ]);
    expect(youtubeIntervals(3600, 12)).toHaveLength(6);
    expect(youtubeIntervals(999, 5)).toEqual([{ start: 0, end: 999 }]);
  });
  it('rejects clip-relative times and trusts confirmed full duration over model guesses', () => {
    const output = {
      available: true,
      durationSeconds: 500,
      sections: [
        {
          start: 666,
          end: 999,
          text: 'Later teaching.',
          concepts: ['Client', 'Server'],
          relationships: [],
          orders: [],
        },
      ],
      warnings: [],
    };
    expect(validateYoutubeObservations(output, 999, 666, 999).sections[0].end).toBe(999);
    expect(() =>
      validateYoutubeObservations(
        { ...output, sections: [{ start: 0, end: 333, text: 'Relative times' }] },
        999,
        666,
        999,
      ),
    ).toThrow();
  });
  it('reads confirmed duration from bounded public metadata without fetching media or captions', async () => {
    const request = vi.fn(async (url: string) =>
      url.includes('oembed')
        ? Response.json({ title: 'Public lesson', html: '<iframe></iframe>' })
        : new Response('<html><meta itemprop="duration" content="PT16M39S"></html>', {
            headers: { 'Content-Type': 'text/html' },
          }),
    );
    vi.stubGlobal('fetch', request);
    const metadata = await youtubeMetadata('abcdefghijk', {
      ...aiConfig(),
      youtubeKey: '',
      youtubeOAuth: '',
    });
    expect(metadata.duration).toBe(999);
    expect(request.mock.calls.map(([url]) => url)).toHaveLength(2);
    expect(request.mock.calls[1][0]).toBe('https://www.youtube.com/watch?v=abcdefghijk');
  });
  it('rejects unavailable videos and invalid model timestamp claims before creating sources', () => {
    const valid = {
      available: true,
      durationSeconds: 100,
      sections: [
        { start: 0, end: 40, text: 'Observed first topic', orders: [] },
        { start: 40, end: 100, text: 'Observed second topic', orders: [] },
      ],
      warnings: [],
    };
    expect(validateYoutubeObservations(valid, 120).sections).toHaveLength(2);
    expect(() =>
      validateYoutubeObservations({ ...valid, available: false, sections: [] }, 120),
    ).toThrow(/could not be read/);
    expect(() => validateYoutubeObservations({ ...valid, durationSeconds: 80 }, 120)).toThrow(
      /timestamps/,
    );
    expect(() =>
      validateYoutubeObservations(
        { ...valid, sections: [{ start: 20, end: 10, text: 'Invalid', orders: [] }] },
        120,
      ),
    ).toThrow(/timestamps/);
    expect(() =>
      validateYoutubeObservations(
        {
          ...valid,
          sections: [
            { start: 0, end: 50, text: 'First', orders: [] },
            { start: 40, end: 80, text: 'Overlaps', orders: [] },
          ],
        },
        120,
      ),
    ).toThrow(/overlap/);
  });
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
