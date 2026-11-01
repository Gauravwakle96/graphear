import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtemp, rm, readFile, readdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import sharp from 'sharp';
import { zipSync, strToU8, unzipSync } from 'fflate';
import { aiConfig, type AIConfig } from '../ai/config';
import {
  persistUpload,
  extractDocument,
  extractMedia,
  officeParts,
  inside,
  runMedia,
  validatedText,
} from './files';
import { notesPdf, notesDocx, learningPackage } from './exports';
import { testAnalysis, testSources } from '../../../../packages/core/src/study.test-support';
import type { LearningInput } from './store';
let dir: string, config: AIConfig;
beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), 'graphear-learning-test-'));
  config = { ...aiConfig(), uploadDir: dir };
});
describe('plain educational notes and authorized subtitles', () => {
  it('reads UTF-8 notes and real SRT timestamps and rejects disguised binary data', async () => {
    const note = await persistUpload(
      Buffer.from('# Networks\nA client sends a request.'),
      'notes.md',
      config,
    );
    const extracted = await extractDocument(
      input(note.path, note.mime),
      config,
      AbortSignal.timeout(1000),
    );
    expect(extracted.sources[0].text).toContain('client sends');
    const subtitle = await persistUpload(
      Buffer.from('1\n00:00:01,000 --> 00:00:05,000\nA client sends a request.\n'),
      'lesson.srt',
      config,
    );
    const captions = await extractDocument(
      input(subtitle.path, subtitle.mime),
      config,
      AbortSignal.timeout(1000),
    );
    expect(captions.sources[0]).toMatchObject({ start: 1, end: 5, kind: 'transcript' });
    expect(() => validatedText(new Uint8Array([0xff, 0xfe, 0xfd]))).toThrow(/UTF-8/);
    expect(() => validatedText(Buffer.from('abc\x00def'))).toThrow(/binary/);
    await expect(persistUpload(Buffer.from('Plain notes'), 'fake.srt', config)).rejects.toThrow(
      /intervals/,
    );
    const png = await sharp({ create: { width: 10, height: 10, channels: 3, background: 'white' } })
      .png()
      .toBuffer();
    await expect(persistUpload(png, 'image.txt', config)).rejects.toThrow(/extension/);
  });
});
afterAll(async () => {
  if (
    !resolve(dir).startsWith(
      resolve(tmpdir()) + '/'.replace('/', process.platform === 'win32' ? '\\' : '/'),
    )
  )
    throw new Error('Unexpected test directory');
  await rm(dir, { recursive: true, force: true });
});
const input = (path: string, mime: string): LearningInput => ({
  kind: 'file',
  name: 'test',
  path,
  mime,
  text: '',
  url: null,
  videoId: null,
  duration: null,
  embed: false,
});
describe('real source extraction and exports', () => {
  it('terminates cancelled and timed-out media processes before returning failure', async () => {
    const args = ['-e', 'setInterval(() => {}, 1000)'];
    await expect(runMedia(process.execPath, args, AbortSignal.abort())).rejects.toThrow(
      'Media processing cancelled',
    );
    await expect(
      runMedia(process.execPath, args, new AbortController().signal, 30),
    ).rejects.toThrow('Media processing timed out');
  });
  it('validates magic bytes, image limits and private paths', async () => {
    await expect(
      persistUpload(Buffer.from('<script>fake</script>'), 'image.png', config),
    ).rejects.toThrow(/supported/);
    expect(() => inside(dir, join(dir, '..', 'private'))).toThrow();
    const image = await sharp({
      create: { width: 100, height: 80, channels: 3, background: 'white' },
    })
      .png()
      .toBuffer();
    const stored = await persistUpload(image, '../../unsafe.png', config);
    expect(stored.path.startsWith(dir)).toBe(true);
    const result = await extractDocument(
      input(stored.path, stored.mime),
      config,
      AbortSignal.timeout(10000),
    );
    expect(result.images).toHaveLength(1);
    expect(result.sources[0].kind).toBe('image');
  });
  it('extracts PDF text with physical page references and renders scanned pages', async () => {
    const pdf = await PDFDocument.create();
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    pdf.addPage([400, 400]).drawText('Client sends a request to server', { font, x: 30, y: 340 });
    const img = await sharp({
      create: { width: 100, height: 80, channels: 3, background: 'white' },
    })
      .png()
      .toBuffer();
    pdf
      .addPage([400, 400])
      .drawImage(await pdf.embedPng(img), { x: 20, y: 20, width: 100, height: 80 });
    const saved = await persistUpload(Buffer.from(await pdf.save()), 'lesson.pdf', config);
    const result = await extractDocument(
      input(saved.path, saved.mime),
      config,
      AbortSignal.timeout(20000),
    );
    expect(result.sources.map((s) => s.page)).toEqual([1, 2]);
    expect(result.sources[0].text).toContain('Client');
    expect(result.images).toHaveLength(2);
  }, 30000);
  it('extracts DOCX sections and PPTX slide references while rejecting entities and expansion bombs', async () => {
    for (const kind of ['docx', 'pptx'] as const) {
      const key = kind === 'docx' ? 'word/document.xml' : 'ppt/slides/slide1.xml';
      const xml = '<root><p><t>Client sends request</t></p></root>';
      const bytes = zipSync({ [key]: strToU8(xml) });
      const saved = await persistUpload(Buffer.from(bytes), 'lesson.' + kind, config);
      const result = await extractDocument(
        input(saved.path, saved.mime),
        config,
        AbortSignal.timeout(10000),
      );
      expect(result.sources[0].text).toContain('Client');
      if (kind === 'pptx') expect(result.sources[0].reference).toBe('Slide 1');
    }
    expect(() =>
      officeParts(zipSync({ 'word/document.xml': new Uint8Array(12_000_001) }), 'docx'),
    ).toThrow(/safe/);
    const bytes = zipSync({ 'word/document.xml': strToU8('<!DOCTYPE foo><root/>') });
    const saved = await persistUpload(Buffer.from(bytes), 'bad.docx', config);
    await expect(
      extractDocument(input(saved.path, saved.mime), config, AbortSignal.timeout(10000)),
    ).rejects.toThrow(/entities/);
  });
  it('extracts actual WAV audio chunks and video frames using FFmpeg', async () => {
    const wav = join(dir, 'sample.wav'),
      video = join(dir, 'sample.mp4');
    await runMedia(
      config.ffmpeg,
      ['-v', 'error', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=1', '-y', wav],
      AbortSignal.timeout(15000),
    );
    const audio = await extractMedia(
      input(wav, 'audio/wav'),
      config,
      AbortSignal.timeout(15000),
      async (data) => {
        expect(data.length).toBeGreaterThan(1000);
        return 'Synthetic test transcript';
      },
      () => undefined,
    );
    expect(audio.sources[0].start).toBe(0);
    await runMedia(
      config.ffmpeg,
      [
        '-v',
        'error',
        '-f',
        'lavfi',
        '-i',
        'color=c=white:s=320x240:d=1',
        '-c:v',
        'libx264',
        '-y',
        video,
      ],
      AbortSignal.timeout(15000),
    );
    const result = await extractMedia(
      input(video, 'video/mp4'),
      config,
      AbortSignal.timeout(15000),
      async () => '',
      () => undefined,
    );
    expect(result.images).toHaveLength(1);
    expect(result.sources[0].kind).toBe('frame');
  }, 30000);
  it('detects a real visual scene transition and retains its actual timestamp', async () => {
    const path = join(dir, 'transition.mp4');
    await runMedia(
      config.ffmpeg,
      [
        '-v',
        'error',
        '-f',
        'lavfi',
        '-i',
        'color=c=white:s=320x240:d=3',
        '-f',
        'lavfi',
        '-i',
        'color=c=black:s=320x240:d=3',
        '-filter_complex',
        '[0:v][1:v]concat=n=2:v=1:a=0[v]',
        '-map',
        '[v]',
        '-c:v',
        'libx264',
        '-y',
        path,
      ],
      AbortSignal.timeout(15000),
    );
    const result = await extractMedia(
      input(path, 'video/mp4'),
      config,
      AbortSignal.timeout(20000),
      async () => '',
      () => undefined,
    );
    const scene = result.sources.find((s) => s.id === 'scene0');
    expect(scene?.start).toBeCloseTo(3, 0);
  }, 30000);
  it('produces real parseable PDF, DOCX and a package with diagram SVG/PNG', async () => {
    const a = testAnalysis();
    const pdf = await notesPdf(a, testSources, 'detailed');
    expect((await PDFDocument.load(pdf)).getPageCount()).toBeGreaterThan(0);
    const docx = unzipSync(await notesDocx(a, testSources, 'exam'));
    expect(new TextDecoder().decode(docx['word/document.xml'])).toContain('Working principle');
    const pack = unzipSync(await learningPackage(a, testSources));
    expect(pack['notes.pdf']).toBeDefined();
    expect(pack['diagrams/diagram1.svg']).toBeDefined();
    expect((await sharp(pack['diagrams/diagram1.png']).metadata()).format).toBe('png');
  }, 30000);
  it('does not leave a failed document extraction asset folder behind', async () => {
    const entries = await readdir(dir);
    const bytes = zipSync({ 'word/document.xml': strToU8('<!DOCTYPE entity><root/>') });
    const saved = await persistUpload(Buffer.from(bytes), 'bad.docx', config);
    await expect(
      extractDocument(input(saved.path, saved.mime), config, AbortSignal.timeout(10000)),
    ).rejects.toThrow();
    expect((await readdir(dir)).length).toBe(entries.length + 1);
    expect(await readFile(saved.path)).toBeDefined();
  });
});
