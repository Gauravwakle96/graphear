import type { AIConfig } from '../ai/config';
import type { Source } from '@graphear/core';
import { timestamp } from '@graphear/core';
export function youtubeId(value: string) {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error('Enter a valid YouTube URL');
  }
  if (url.protocol !== 'https:' || url.username || url.password)
    throw new Error('Use a public HTTPS YouTube URL');
  const host = url.hostname.toLowerCase();
  if (
    ![
      'youtube.com',
      'www.youtube.com',
      'm.youtube.com',
      'youtu.be',
      'www.youtube-nocookie.com',
    ].includes(host)
  )
    throw new Error('Only YouTube URLs are supported');
  const id =
    host === 'youtu.be'
      ? url.pathname.slice(1).split('/')[0]
      : url.pathname === '/watch'
        ? url.searchParams.get('v')
        : url.pathname.match(/^\/(?:embed|shorts)\/([^/]+)/)?.[1];
  if (!id || !/^[a-zA-Z0-9_-]{11}$/.test(id)) throw new Error('YouTube video ID is invalid');
  return id;
}
const seconds = (text: string) =>
  text
    .replace(',', '.')
    .split(':')
    .reduce((total, part) => total * 60 + Number(part), 0);
export function parseCaptions(vtt: string): Source[] {
  if (vtt.length > 2_000_000) throw new Error('Caption file is too large');
  const cues: { text: string; start: number; end: number }[] = [];
  for (const block of vtt.split(/\r?\n\s*\r?\n/)) {
    const lines = block.split(/\r?\n/),
      i = lines.findIndex((l) => l.includes('-->'));
    if (i < 0) continue;
    const match = lines[i].match(/([\d:]+[.,]\d+)\s+-->\s+([\d:]+[.,]\d+)/);
    if (!match) continue;
    const start = seconds(match[1]),
      end = seconds(match[2]);
    if (!Number.isFinite(start) || end < start) continue;
    const text = lines
      .slice(i + 1)
      .join(' ')
      .replace(/<[^>]*>/g, '')
      .trim();
    if (text) cues.push({ start, end, text });
  }
  const sources: Source[] = [];
  for (const cue of cues) {
    const previous = sources.at(-1);
    if (previous && cue.start - (previous.start ?? 0) < 90 && previous.text.length < 8000) {
      previous.text += ' ' + cue.text;
      previous.end = cue.end;
      previous.reference = `${timestamp(previous.start!)}–${timestamp(cue.end)}`;
    } else
      sources.push({
        id: 'caption' + sources.length,
        reference: `${timestamp(cue.start)}–${timestamp(cue.end)}`,
        kind: 'transcript',
        text: cue.text.slice(0, 16000),
        page: null,
        start: cue.start,
        end: cue.end,
        asset: null,
      });
  }
  if (sources.length > 80)
    throw new Error(
      'Caption source is too long. Supply a shorter transcript or split the material.',
    );
  return sources;
}
export async function youtubeMetadata(id: string, config: AIConfig) {
  const watch = `https://www.youtube.com/watch?v=${id}`;
  let title = 'YouTube learning session',
    embed = false,
    duration: number | null = null;
  try {
    const response = await fetch(
      `https://www.youtube.com/oembed?url=${encodeURIComponent(watch)}&format=json`,
      { signal: AbortSignal.timeout(10_000) },
    );
    if (response.ok) {
      const body = (await response.json()) as { title?: string; html?: string };
      title = (body.title ?? title).slice(0, 180);
      embed = typeof body.html === 'string' && body.html.includes('iframe');
    }
  } catch {
    /* Metadata unavailable does not authorize fetching protected content. */
  }
  if (config.youtubeKey || config.youtubeOAuth) {
    try {
      const response = await fetch(
        `https://www.googleapis.com/youtube/v3/videos?part=contentDetails&id=${id}`,
        {
          headers: config.youtubeOAuth
            ? { Authorization: `Bearer ${config.youtubeOAuth}` }
            : { 'x-goog-api-key': config.youtubeKey },
          signal: AbortSignal.timeout(10_000),
        },
      );
      if (response.ok) {
        const body = (await response.json()) as {
          items?: { contentDetails?: { duration?: string } }[];
        };
        const match = body.items?.[0]?.contentDetails?.duration?.match(
          /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/,
        );
        if (match)
          duration =
            Number(match[1] ?? 0) * 3600 + Number(match[2] ?? 0) * 60 + Number(match[3] ?? 0);
      }
    } catch {
      /* Keep an explicitly unknown duration. */
    }
  }
  return { title, embed, duration, url: watch };
}
export async function youtubeCaptions(
  id: string,
  config: AIConfig,
  signal: AbortSignal,
): Promise<Source[]> {
  if (!config.youtubeOAuth)
    throw new Error(
      'Captions need permitted YouTube OAuth access. Supply a transcript or authorized audio/video file.',
    );
  const headers = { Authorization: `Bearer ${config.youtubeOAuth}` };
  const list = await fetch(
    `https://www.googleapis.com/youtube/v3/captions?part=snippet&videoId=${id}`,
    { headers, signal },
  );
  if (!list.ok)
    throw new Error(
      'YouTube captions are unavailable with the configured permissions. Supply an authorized transcript/media file.',
    );
  const data = (await list.json()) as { items?: { id: string; snippet?: { language: string } }[] };
  const track = data.items?.find((i) => i.snippet?.language === 'en') ?? data.items?.[0];
  if (!track)
    throw new Error(
      'No accessible captions were found. Supply an authorized transcript/media file.',
    );
  const response = await fetch(
    `https://www.googleapis.com/youtube/v3/captions/${encodeURIComponent(track.id)}?tfmt=vtt`,
    { headers, signal },
  );
  if (!response.ok)
    throw new Error(
      'YouTube did not permit caption download. Supply an authorized transcript/media file.',
    );
  const sources = parseCaptions(await response.text());
  if (!sources.length) throw new Error('Accessible captions contained no usable text');
  return sources;
}
