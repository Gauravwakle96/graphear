import { randomUUID } from 'node:crypto';
import { Router, type Request } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { optionsSchema, validateAnalysis } from '@graphear/core';
import type { Store } from '../store';
import { aiConfig, configured, type AIConfig } from '../ai/config';
import { LearningStore, publicLearning, type LearningInput } from './store';
import { LearningService, safeError } from './service';
import { persistUpload, inside, removePrivate, supportedMimes } from './files';
import { youtubeId, youtubeMetadata } from './youtube';
import { notesPdf, notesDocx, learningPackage } from './exports';
import type { AIProvider } from '../ai/providers';
const idSchema = z.uuid();
export function learningRouter(
  base: Store,
  authenticate: (req: Request, mutation?: boolean) => string,
  config: AIConfig = aiConfig(),
  provider?: AIProvider,
) {
  const router = Router(),
    store = new LearningStore(base),
    service = new LearningService(store, config, provider);
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: config.uploadBytes, files: 1, fields: 12, fieldSize: 250_000 },
  });
  const uploading = new Set<string>();
  const uploadSlot = (
    _req: Request,
    res: import('express').Response,
    next: import('express').NextFunction,
  ) => {
    const owner = String(res.locals.owner);
    if (uploading.has(owner) || uploading.size >= 2)
      return res
        .status(429)
        .json({ error: 'An upload is already in progress. Try again after it finishes.' });
    uploading.add(owner);
    const release = () => uploading.delete(owner);
    res.once('finish', release);
    res.once('close', release);
    next();
  };
  router.get('/config', (_req, res) =>
    res.json({
      provider: config.provider,
      model: config.model,
      configured: configured(config),
      captionsConfigured: Boolean(config.youtubeOAuth),
      limits: {
        uploadMB: config.uploadBytes / 1024 / 1024,
        documentMB: 20,
        mediaMinutes: config.mediaSeconds / 60,
        pdfPages: 50,
        retentionHours: config.retentionHours,
      },
      privacy:
        'AI mode stores private source material and sends selected content to the configured provider. Local diagram mode remains on-device.',
    }),
  );
  router.use((req, res, next) => {
    try {
      res.locals.owner = authenticate(req, !['GET', 'HEAD'].includes(req.method));
      next();
    } catch (error) {
      next(error);
    }
  });
  const owned = (req: Request, owner: string) => {
    const parsed = idSchema.safeParse(req.params.id);
    if (!parsed.success) throw new Error('Invalid learning session ID');
    const session = store.get(owner, parsed.data);
    if (!session) return null;
    return session;
  };
  router.get('/', (_req, res) =>
    res.json({
      sessions: store.list(res.locals.owner).map((s) => ({
        id: s.id,
        title: s.title,
        status: s.status,
        progress: s.progress,
        createdAt: s.createdAt,
        updatedAt: s.updatedAt,
        category: s.analysis?.category ?? null,
        revision: s.revision,
      })),
    }),
  );
  router.post('/', uploadSlot, upload.single('file'), async (req, res, next) => {
    let storedPath: string | null = null;
    try {
      if (store.list(res.locals.owner).length >= 100)
        return res.status(422).json({
          error: 'Your workspace contains 100 learning sessions. Delete/export one first.',
        });
      const raw =
        typeof req.body.options === 'string' ? JSON.parse(req.body.options) : req.body.options;
      const options = optionsSchema.parse(raw);
      const processNow = req.body.process === true || req.body.process === 'true';
      if (processNow && !configured(config))
        return res.status(503).json({
          error: 'AI provider is not configured. Save a draft or configure its backend key.',
        });
      const type = z.enum(['file', 'text', 'youtube']).parse(req.body.kind);
      const text = z
        .string()
        .max(180_000)
        .parse(req.body.text ?? '');
      const input: LearningInput = {
        kind: type,
        name: String(req.body.title ?? 'Learning session').slice(0, 180),
        mime: null,
        path: null,
        text,
        url: null,
        videoId: null,
        duration: null,
        embed: false,
      };
      if (req.file) {
        const file = await persistUpload(req.file.buffer, req.file.originalname, config);
        storedPath = file.path;
        input.path = file.path;
        input.mime = file.mime;
        input.name = req.file.originalname.slice(0, 180);
      }
      if (type === 'youtube') {
        input.videoId = youtubeId(z.string().max(500).parse(req.body.url));
        if (input.mime && !supportedMimes.mediaMimes.has(input.mime))
          throw new Error('For a YouTube source, attach only authorized audio/video material');
        const metadata = await youtubeMetadata(input.videoId, config);
        input.url = metadata.url;
        input.name = metadata.title;
        input.embed = metadata.embed;
        input.duration = metadata.duration;
        if (!input.path && !text && !config.youtubeOAuth && processNow)
          throw new Error(
            'Supply an authorized transcript/media file or configure permitted YouTube caption access',
          );
      }
      if (type === 'file' && !input.path) throw new Error('Choose a source file');
      if (type === 'text' && !text.trim())
        throw new Error('Paste educational content before creating a session');
      const session = store.create(
        res.locals.owner,
        input,
        options,
        config.retentionHours,
        processNow,
      );
      res.status(201).json(publicLearning(session));
    } catch (error) {
      if (storedPath) await removePrivate(config, storedPath).catch(() => undefined);
      next(error);
    }
  });
  router.get('/:id', (req, res) => {
    const s = owned(req, res.locals.owner);
    if (!s) return res.status(404).json({ error: 'Learning session not found in your workspace' });
    res.json(publicLearning(s));
  });
  router.post('/:id/process', (req, res) => {
    const s = owned(req, res.locals.owner);
    if (!s) return res.sendStatus(404);
    if (!configured(config))
      return res
        .status(503)
        .json({ error: 'Configure the selected AI provider key on the backend' });
    if (['queued', 'extracting', 'generating'].includes(s.status))
      return res.status(409).json({ error: 'This session is already processing' });
    if (s.status === 'completed') return res.json(publicLearning(s));
    store.state(s.owner, s.id, 'queued', 0, 'Waiting for processing');
    res.json(publicLearning(store.get(s.owner, s.id)!));
  });
  router.post('/:id/cancel', (req, res) => {
    const s = owned(req, res.locals.owner);
    if (!s) return res.sendStatus(404);
    res.json(publicLearning(service.cancel(s.owner, s.id)!));
  });
  router.patch('/:id', async (req, res, next) => {
    try {
      const s = owned(req, res.locals.owner);
      if (!s) return res.sendStatus(404);
      if (['extracting', 'generating', 'queued'].includes(s.status))
        return res.status(409).json({ error: 'Wait for processing to finish before editing' });
      const body = z
        .object({
          title: z.string().trim().min(1).max(180).optional(),
          analysis: z.unknown().optional(),
          revision: z.number().int().positive(),
        })
        .strict()
        .parse(req.body);
      if (body.title) s.title = body.title;
      if (body.analysis) {
        const validated = validateAnalysis(body.analysis, s.sources);
        const original = body.analysis as { diagrams: { id: string; reviewed: boolean }[] };
        for (const d of validated.diagrams)
          d.reviewed = Boolean(original.diagrams.find((o) => o.id === d.id)?.reviewed);
        s.analysis = validated;
      }
      const saved = store.write(s, body.revision);
      if (!saved)
        return res
          .status(409)
          .json({ error: 'This learning session changed in another tab. Reload and try again.' });
      res.json(publicLearning(saved));
    } catch (e) {
      next(e);
    }
  });
  router.post('/:id/chat', async (req, res, next) => {
    try {
      const s = owned(req, res.locals.owner);
      if (!s) return res.sendStatus(404);
      const body = z
        .object({
          question: z.string().trim().min(1).max(2000),
          diagram: z.boolean().default(false),
        })
        .strict()
        .parse(req.body);
      res.json(publicLearning(await service.tutor(s, body.question, body.diagram)));
    } catch (e) {
      next(e);
    }
  });
  router.post('/:id/questions', async (req, res, next) => {
    try {
      const s = owned(req, res.locals.owner);
      if (!s) return res.sendStatus(404);
      const body = z
        .object({
          count: z.number().int().min(1).max(20),
          difficulty: z.enum(['easy', 'medium', 'hard']),
        })
        .strict()
        .parse(req.body);
      res.json(publicLearning(await service.questions(s, body.count, body.difficulty)));
    } catch (e) {
      next(e);
    }
  });
  router.post('/:id/quiz', (req, res, next) => {
    try {
      const s = owned(req, res.locals.owner);
      if (!s?.analysis) return res.status(404).json({ error: 'No generated questions available' });
      const body = z
        .object({ answers: z.record(z.string().max(80), z.string().max(4000)) })
        .strict()
        .parse(req.body);
      const questions = s.analysis.questions;
      if (
        questions.some((q) => !body.answers[q.id]?.trim()) ||
        Object.keys(body.answers).some((id) => !questions.some((q) => q.id === id))
      )
        return res.status(400).json({ error: 'Answer each question in the current test' });
      const choice = questions.filter((q) => ['mcq', 'truefalse'].includes(q.kind));
      s.quizAttempts = [
        ...s.quizAttempts,
        {
          id: randomUUID(),
          createdAt: new Date().toISOString(),
          total: choice.length,
          correct: choice.filter((q) => body.answers[q.id] === q.answer).length,
          answers: body.answers,
        },
      ].slice(-50);
      const saved = store.write(s);
      if (!saved)
        return res
          .status(409)
          .json({ error: 'Session changed. Reload before saving your attempt.' });
      res.json(publicLearning(saved));
    } catch (e) {
      next(e);
    }
  });
  router.get('/:id/file', (req, res, next) => {
    const s = owned(req, res.locals.owner);
    if (!s) return res.sendStatus(404);
    if (!s.input.path || s.assetExpiresAt < Date.now())
      return res.status(410).json({ error: 'Original file has expired or was removed' });
    res.type(s.input.mime ?? 'application/octet-stream');
    if (
      !supportedMimes.imageMimes.has(s.input.mime ?? '') &&
      !supportedMimes.mediaMimes.has(s.input.mime ?? '')
    )
      res.attachment(s.input.name);
    res.sendFile(inside(config.uploadDir, s.input.path), (error) => {
      if (error) next(error);
    });
  });
  router.get('/:id/sources/:sourceId', (req, res, next) => {
    const s = owned(req, res.locals.owner);
    if (!s) return res.sendStatus(404);
    const src = s.sources.find((v) => v.id === req.params.sourceId);
    if (!src?.asset || s.assetExpiresAt < Date.now())
      return res.status(410).json({ error: 'Source image expired or is unavailable' });
    res.type('image/jpeg').sendFile(inside(config.uploadDir, src.asset), (error) => {
      if (error) next(error);
    });
  });
  router.get('/:id/export/:format', async (req, res, next) => {
    try {
      const s = owned(req, res.locals.owner);
      if (!s?.analysis)
        return res.status(404).json({ error: 'No completed study material to export' });
      const style = z.enum(['detailed', 'short', 'exam']).parse(req.query.style ?? 'detailed');
      const format = z.enum(['pdf', 'docx', 'flashcards', 'package']).parse(req.params.format);
      const buffer =
        format === 'docx'
          ? await notesDocx(s.analysis, s.sources, style)
          : format === 'package'
            ? await learningPackage(s.analysis, s.sources, {
                chat: s.chat,
                quizAttempts: s.quizAttempts,
              })
            : await notesPdf(s.analysis, s.sources, style, format === 'flashcards');
      const ext = format === 'flashcards' ? 'pdf' : format === 'package' ? 'zip' : format;
      res
        .attachment(`graphear-learning.${ext}`)
        .type(
          ext === 'pdf'
            ? 'application/pdf'
            : ext === 'docx'
              ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
              : 'application/zip',
        )
        .send(buffer);
    } catch (e) {
      next(e);
    }
  });
  router.delete('/:id', async (req, res, next) => {
    try {
      const s = owned(req, res.locals.owner);
      if (!s) return res.sendStatus(404);
      await service.cancelAndWait(s.owner, s.id);
      const latest = store.get(s.owner, s.id) ?? s;
      for (const path of [
        ...new Set(
          [latest.input.path, ...latest.sources.map((v) => v.asset)].filter(Boolean) as string[],
        ),
      ])
        await removePrivate(config, path);
      store.delete(s.owner, s.id);
      res.sendStatus(204);
    } catch (e) {
      next(e);
    }
  });
  router.use(
    (
      error: unknown,
      _req: Request,
      res: import('express').Response,
      _next: import('express').NextFunction,
    ) => {
      if (error instanceof Error && 'status' in error && [401, 403].includes(Number(error.status)))
        return _next(error);
      if (error instanceof multer.MulterError)
        return res.status(413).json({ error: 'Upload exceeds its file or field limits' });
      if (error instanceof z.ZodError)
        return res.status(400).json({
          error: 'Invalid learning request or generated data. Check the selected inputs.',
        });
      res.status(400).json({ error: safeError(error) });
    },
  );
  return { router, service };
}
