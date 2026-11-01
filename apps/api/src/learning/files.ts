import { fileTypeFromBuffer } from 'file-type';
import sharp from 'sharp';
import { XMLParser } from 'fast-xml-parser';
import { unzipSync } from 'fflate';
import { mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { resolve, sep, join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { createCanvas } from '@napi-rs/canvas';
import type { Source } from '@graphear/core';
import { timestamp } from '@graphear/core';
import type { AIConfig } from '../ai/config';
import type { VisionInput } from '../ai/providers';
import type { LearningInput } from './store';
const imageMimes = new Set(['image/png', 'image/jpeg', 'image/webp']);
const mediaMimes = new Set([
  'video/mp4',
  'video/quicktime',
  'video/webm',
  'video/x-matroska',
  'audio/mpeg',
  'audio/wav',
  'audio/x-wav',
  'audio/mp4',
  'audio/x-m4a',
  'audio/ogg',
]);
export const supportedMimes = { imageMimes, mediaMimes };
export function inside(root: string, path: string) {
  const resolved = resolve(path),
    base = resolve(root);
  if (!resolved.startsWith(base + sep) || resolved === base)
    throw new Error('Invalid private file location');
  return resolved;
}
const plain = (xml: string) => {
  if (/<!DOCTYPE|<!ENTITY/i.test(xml)) throw new Error('Document entities are not allowed');
  const parser = new XMLParser({
    ignoreAttributes: false,
    processEntities: false,
    removeNSPrefix: true,
  });
  const tree = parser.parse(xml);
  const parts: string[] = [];
  const visit = (value: unknown, key = '') => {
    if (typeof value === 'string' || typeof value === 'number') {
      if (key === 't' || key === '#text') parts.push(String(value));
      return;
    }
    if (Array.isArray(value)) {
      value.forEach((v) => visit(v, key));
      return;
    }
    if (value && typeof value === 'object') for (const [k, v] of Object.entries(value)) visit(v, k);
  };
  visit(tree);
  return parts
    .join(' ')
    .replace(
      /&(?:lt|gt|amp|quot|apos);/g,
      (s) => ({ '&lt;': '<', '&gt;': '>', '&amp;': '&', '&quot;': '"', '&apos;': "'" })[s]!,
    )
    .trim();
};
export function officeParts(buffer: Uint8Array, kind: 'docx' | 'pptx') {
  let declared = 0;
  const parts = unzipSync(buffer, {
    filter: (f) => {
      const allowed =
        kind === 'docx'
          ? /^word\/(document\.xml|media\/[^/]+\.(png|jpe?g|webp))$/i.test(f.name)
          : /^ppt\/(slides\/slide\d+\.xml|slides\/_rels\/slide\d+\.xml\.rels|media\/[^/]+\.(png|jpe?g|webp))$/i.test(
              f.name,
            );
      if (!allowed) return false;
      declared += f.originalSize;
      if (f.originalSize > 12_000_000 || declared > 40_000_000)
        throw new Error('Document expands beyond safe processing limits');
      return true;
    },
  });
  if (kind === 'docx' && !parts['word/document.xml'])
    throw new Error('This is not a valid DOCX document');
  if (kind === 'pptx' && !Object.keys(parts).some((k) => /^ppt\/slides\/slide\d+\.xml$/.test(k)))
    throw new Error('This is not a valid PPTX presentation');
  return parts;
}
export async function persistUpload(buffer: Buffer, name: string, config: AIConfig) {
  if (buffer.length > config.uploadBytes)
    throw new Error('Upload exceeds the configured size limit');
  const type = await fileTypeFromBuffer(buffer);
  const ext = name.toLowerCase().split('.').at(-1);
  let mime = type?.mime,
    canonical = type?.ext;
  const allowed: Record<string, string[]> = {
    png: ['image/png'],
    jpg: ['image/jpeg'],
    jpeg: ['image/jpeg'],
    webp: ['image/webp'],
    pdf: ['application/pdf'],
    docx: [
      'application/zip',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ],
    pptx: [
      'application/zip',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    ],
    mp4: ['video/mp4', 'audio/mp4', 'audio/x-m4a'],
    mov: ['video/quicktime'],
    webm: ['video/webm'],
    mkv: ['video/x-matroska'],
    mp3: ['audio/mpeg'],
    wav: ['audio/wav', 'audio/x-wav'],
    m4a: ['audio/mp4', 'audio/x-m4a', 'video/mp4'],
  };
  if (!ext || !mime || !allowed[ext]?.includes(mime))
    throw new Error('Choose a supported file whose contents match its extension');
  if (ext === 'docx' || ext === 'pptx') {
    if (buffer.length > 20 * 1024 * 1024) throw new Error('Documents are limited to 20 MB');
    if (
      ![
        'application/zip',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      ].includes(mime ?? '')
    )
      throw new Error('Document contents do not match its format');
    officeParts(buffer, ext);
    mime =
      ext === 'docx'
        ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        : 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
    canonical = ext;
  }
  if (
    !mime ||
    (!imageMimes.has(mime) &&
      !mediaMimes.has(mime) &&
      ![
        'application/pdf',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      ].includes(mime))
  )
    throw new Error('Choose a supported image, PDF, DOCX, PPTX, video or audio file');
  if (
    (imageMimes.has(mime) ||
      mime === 'application/pdf' ||
      canonical === 'docx' ||
      canonical === 'pptx') &&
    buffer.length > 20 * 1024 * 1024
  )
    throw new Error('Images and documents are limited to 20 MB');
  if (imageMimes.has(mime)) await sharp(buffer, { limitInputPixels: 16_000_000 }).metadata();
  await mkdir(config.uploadDir, { recursive: true });
  const path = join(config.uploadDir, randomUUID() + '.' + canonical);
  await writeFile(path, buffer, { flag: 'wx' });
  return { path, mime };
}
export async function removePrivate(config: AIConfig, path: string) {
  await rm(inside(config.uploadDir, path), { force: true });
}
export async function runMedia(
  binary: string,
  args: string[],
  signal: AbortSignal,
  timeout = 90_000,
) {
  return new Promise<string>((resolveResult, reject) => {
    const child = spawn(binary, args, { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
    let output = '',
      error = '',
      settled = false;
    let stopped: Error | undefined;
    const finish = (failure?: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      signal.removeEventListener('abort', abort);
      if (failure) reject(failure);
      else resolveResult(output);
    };
    const abort = () => {
      stopped = new Error('Media processing cancelled');
      child.kill();
    };
    const timer = setTimeout(() => {
      stopped = new Error('Media processing timed out. Try a shorter file.');
      child.kill();
    }, timeout);
    signal.addEventListener('abort', abort, { once: true });
    child.stdout.on('data', (b) => {
      output += String(b);
      if (output.length > 1_000_000) {
        stopped = new Error('Media metadata is too large');
        child.kill();
      }
    });
    child.stderr.on('data', (b) => {
      error = (error + String(b)).slice(-4000);
    });
    child.on('error', () =>
      finish(new Error('FFmpeg/FFprobe is unavailable. Configure the backend media tools.')),
    );
    child.on('close', (code) =>
      finish(
        stopped ??
          (code === 0
            ? undefined
            : new Error(
                error.includes('Invalid data')
                  ? 'Unsupported or damaged media file'
                  : 'Media could not be processed safely',
              )),
      ),
    );
    if (signal.aborted) abort();
  });
}
export type Extraction = {
  sources: Source[];
  images: { sourceId: string; image: VisionInput }[];
  warnings: string[];
  duration: number | null;
};
const source = (
  id: string,
  reference: string,
  kind: Source['kind'],
  text = '',
  page: number | null = null,
  start: number | null = null,
  end: number | null = null,
  asset: string | null = null,
): Source => ({ id, reference, kind, text: text.slice(0, 16000), page, start, end, asset });
async function rasterAsset(
  data: Buffer,
  id: string,
  config: AIConfig,
): Promise<{ path: string; image: VisionInput }> {
  const buffer = await sharp(data, { limitInputPixels: 16_000_000 })
    .rotate()
    .resize({ width: 1400, height: 1400, fit: 'inside', withoutEnlargement: true })
    .flatten({ background: '#fff' })
    .jpeg({ quality: 88 })
    .toBuffer();
  const path = join(config.uploadDir, randomUUID() + '-' + id + '.jpg');
  await writeFile(path, buffer, { flag: 'wx' });
  return { path, image: { mime: 'image/jpeg', data: buffer.toString('base64') } };
}
export async function extractDocument(
  input: LearningInput,
  config: AIConfig,
  signal: AbortSignal,
): Promise<Extraction> {
  const rootConfig = config;
  config = { ...config, uploadDir: join(config.uploadDir, randomUUID()) };
  await mkdir(config.uploadDir, { recursive: true });
  try {
    const result: Extraction = { sources: [], images: [], warnings: [], duration: null };
    if (input.kind === 'text' || (!input.path && input.text)) {
      for (let i = 0; i < input.text.length; i += 10000)
        result.sources.push(
          source(
            'text' + i,
            `Text section ${Math.floor(i / 10000) + 1}`,
            'text',
            input.text.slice(i, i + 10000),
          ),
        );
      return result;
    }
    if (!input.path)
      throw new Error(
        'Supply an authorized transcript or media file when captions are unavailable',
      );
    const data = await readFile(inside(rootConfig.uploadDir, input.path));
    signal.throwIfAborted();
    if (imageMimes.has(input.mime ?? '')) {
      const asset = await rasterAsset(data, 'image', config);
      result.sources.push(
        source('image1', 'Uploaded image', 'image', '', null, null, null, asset.path),
      );
      result.images.push({ sourceId: 'image1', image: asset.image });
      return result;
    }
    if (input.mime === 'application/pdf') {
      const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
      const task = pdfjs.getDocument({ data: Uint8Array.from(data), useSystemFonts: true });
      const doc = await task.promise;
      try {
        if (doc.numPages > 50)
          throw new Error('PDFs are limited to 50 pages. Split the document first.');
        for (let n = 1; n <= doc.numPages; n++) {
          signal.throwIfAborted();
          const page = await doc.getPage(n);
          const content = await page.getTextContent();
          const text = content.items.map((item) => ('str' in item ? item.str : '')).join(' ');
          const view = page.getViewport({
            scale: Math.min(
              1.5,
              1400 /
                Math.max(
                  page.getViewport({ scale: 1 }).width,
                  page.getViewport({ scale: 1 }).height,
                ),
            ),
          });
          const canvas = createCanvas(Math.ceil(view.width), Math.ceil(view.height));
          await page.render({
            canvas: canvas as unknown as HTMLCanvasElement,
            canvasContext: canvas.getContext('2d') as unknown as CanvasRenderingContext2D,
            viewport: view,
          }).promise;
          const asset = await rasterAsset(
            Buffer.from(canvas.toBuffer('image/png')),
            'page' + n,
            config,
          );
          result.sources.push(
            source(
              'page' + n,
              `Page ${n}`,
              'page',
              text.slice(0, 16000),
              n,
              null,
              null,
              asset.path,
            ),
          );
          for (let offset = 16000; offset < text.length; offset += 16000)
            result.sources.push(
              source(
                `page${n}part${offset}`,
                `Page ${n}, text continuation ${Math.floor(offset / 16000) + 1}`,
                'page',
                text.slice(offset, offset + 16000),
                n,
              ),
            );
          result.images.push({ sourceId: 'page' + n, image: asset.image });
          page.cleanup();
        }
        return result;
      } finally {
        await task.destroy();
      }
    }
    const kind = input.mime?.includes('wordprocessingml')
      ? 'docx'
      : input.mime?.includes('presentationml')
        ? 'pptx'
        : null;
    if (kind) {
      const parts = officeParts(data, kind),
        decode = (v: Uint8Array) => new TextDecoder().decode(v);
      if (kind === 'docx') {
        const text = plain(decode(parts['word/document.xml']));
        for (let i = 0; i < text.length; i += 10000)
          result.sources.push(
            source(
              'doc' + i,
              `Document section ${Math.floor(i / 10000) + 1}`,
              'text',
              text.slice(i, i + 10000),
            ),
          );
        result.warnings.push(
          'DOCX references use text sections, not physical page numbers. Complex vector drawings and layout require source review.',
        );
      } else {
        const slides = Object.keys(parts)
          .filter((k) => /^ppt\/slides\/slide\d+\.xml$/.test(k))
          .sort((a, b) => Number(a.match(/slide(\d+)/)![1]) - Number(b.match(/slide(\d+)/)![1]));
        if (slides.length > 50) throw new Error('Presentations are limited to 50 slides');
        for (const file of slides) {
          const n = Number(file.match(/slide(\d+)/)![1]);
          result.sources.push(
            source('slide' + n, `Slide ${n}`, 'slide', plain(decode(parts[file])), n),
          );
        }
        result.warnings.push(
          'Presentation text and embedded raster images were extracted. Complex slide vector shapes and animations are not reconstructed from their layout.',
        );
      }
      for (const [file, bytes] of Object.entries(parts)
        .filter(([key]) => key.includes('/media/'))
        .slice(0, 8)) {
        const id = 'officeImage' + result.images.length;
        const asset = await rasterAsset(Buffer.from(bytes), id, config);
        result.sources.push(
          source(
            id,
            `Embedded image ${result.images.length + 1} (${file.split('/').at(-1)})`,
            'image',
            '',
            null,
            null,
            null,
            asset.path,
          ),
        );
        result.images.push({ sourceId: id, image: asset.image });
      }
      return result;
    }
    throw new Error('This file requires audio/video processing');
  } catch (error) {
    await rm(inside(rootConfig.uploadDir, config.uploadDir), { recursive: true, force: true });
    throw error;
  }
}
export async function extractMedia(
  input: LearningInput,
  config: AIConfig,
  signal: AbortSignal,
  onTranscribe: (data: Uint8Array) => Promise<string>,
  progress: (value: number, message: string) => void,
): Promise<Extraction> {
  const rootConfig = config;
  config = { ...config, uploadDir: join(config.uploadDir, randomUUID()) };
  await mkdir(config.uploadDir, { recursive: true });
  try {
    if (!input.path) throw new Error('No media file was supplied');
    const path = inside(rootConfig.uploadDir, input.path);
    const raw = await runMedia(
      config.ffprobe,
      [
        '-v',
        'error',
        '-protocol_whitelist',
        'file,pipe',
        '-show_entries',
        'format=duration:stream=codec_type',
        '-of',
        'json',
        path,
      ],
      signal,
    );
    let metadata: { format?: { duration?: string }; streams?: { codec_type: string }[] };
    try {
      metadata = JSON.parse(raw);
    } catch {
      throw new Error('Media metadata could not be read');
    }
    const duration = Number(metadata.format?.duration);
    if (!Number.isFinite(duration) || duration <= 0 || duration > config.mediaSeconds)
      throw new Error(`Media must be shorter than ${config.mediaSeconds / 60} minutes`);
    const result: Extraction = { sources: [], images: [], warnings: [], duration };
    const hasAudio = metadata.streams?.some((s) => s.codec_type === 'audio'),
      hasVideo = metadata.streams?.some((s) => s.codec_type === 'video');
    if (hasAudio)
      for (let start = 0; start < duration; start += 180) {
        signal.throwIfAborted();
        const out = join(config.uploadDir, randomUUID() + '.wav');
        try {
          await runMedia(
            config.ffmpeg,
            [
              '-nostdin',
              '-v',
              'error',
              '-protocol_whitelist',
              'file,pipe',
              '-ss',
              String(start),
              '-i',
              path,
              '-t',
              String(Math.min(180, duration - start)),
              '-vn',
              '-ac',
              '1',
              '-ar',
              '16000',
              '-threads',
              '1',
              '-y',
              out,
            ],
            signal,
          );
          const speech = await onTranscribe(await readFile(out));
          result.sources.push(
            source(
              'audio' + start,
              `${timestamp(start)}–${timestamp(Math.min(duration, start + 180))}`,
              'audio',
              speech,
              null,
              start,
              Math.min(duration, start + 180),
            ),
          );
          progress(15 + Math.round((start / duration) * 30), 'Transcribing audio segments');
        } finally {
          await removePrivate(config, out);
        }
      }
    if (hasVideo) {
      const count = Math.min(4, Math.max(1, Math.ceil(duration / 120)));
      for (let i = 0; i < count; i++) {
        const time = Math.min(duration - 0.05, (duration * (i + 0.5)) / count),
          out = join(config.uploadDir, randomUUID() + '.jpg');
        await runMedia(
          config.ffmpeg,
          [
            '-nostdin',
            '-v',
            'error',
            '-protocol_whitelist',
            'file,pipe',
            '-ss',
            String(time),
            '-i',
            path,
            '-frames:v',
            '1',
            '-vf',
            'scale=1400:1400:force_original_aspect_ratio=decrease',
            '-threads',
            '1',
            '-y',
            out,
          ],
          signal,
        );
        const buffer = await readFile(out);
        const id = 'frame' + i;
        result.sources.push(
          source(id, `Video frame at ${timestamp(time)}`, 'frame', '', null, time, time, out),
        );
        result.images.push({
          sourceId: id,
          image: { mime: 'image/jpeg', data: buffer.toString('base64') },
        });
      }
      result.warnings.push(
        `${count} representative frames were sampled; scenes between samples may be missed. Audio citations identify 3-minute source intervals, not word-level timestamps.`,
      );
      if (duration > 5) {
        const pattern = join(config.uploadDir, 'scene-%02d.jpg');
        try {
          const metadata = await runMedia(
            config.ffmpeg,
            [
              '-nostdin',
              '-v',
              'error',
              '-protocol_whitelist',
              'file,pipe',
              '-threads',
              '1',
              '-i',
              path,
              '-vf',
              'select=gt(scene\\,0.3),metadata=mode=print:file=-,scale=1400:1400:force_original_aspect_ratio=decrease',
              '-fps_mode',
              'vfr',
              '-frames:v',
              '4',
              '-threads',
              '1',
              '-y',
              pattern,
            ],
            signal,
          );
          const times = [...metadata.matchAll(/pts_time:([\d.]+)/g)]
            .slice(0, 4)
            .map((m) => Number(m[1]));
          for (let i = 0; i < times.length; i++) {
            const file = join(config.uploadDir, `scene-${String(i + 1).padStart(2, '0')}.jpg`);
            const buffer = await readFile(file);
            const id = 'scene' + i;
            result.sources.push(
              source(
                id,
                `Scene change at ${timestamp(times[i])}`,
                'frame',
                '',
                null,
                times[i],
                times[i],
                file,
              ),
            );
            result.images.push({
              sourceId: id,
              image: { mime: 'image/jpeg', data: buffer.toString('base64') },
            });
          }
          result.warnings.push(
            'Scene-change candidates use visual differences. AI must decide their educational relevance; static explanations and subtle changes may be missed.',
          );
        } catch (error) {
          signal.throwIfAborted();
          void error;
          result.warnings.push(
            'Scene-change scanning was unavailable or timed out. Representative frame sampling was retained.',
          );
        }
      }
    }
    if (!hasAudio && !hasVideo) throw new Error('No supported audio or video stream found');
    return result;
  } catch (error) {
    await rm(inside(rootConfig.uploadDir, config.uploadDir), { recursive: true, force: true });
    throw error;
  }
}
