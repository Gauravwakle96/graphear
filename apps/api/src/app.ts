import express, { type Request, type Response, type NextFunction } from 'express';
import helmet from 'helmet';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { z } from 'zod';
import { parseGraph, analyzeGraph, graphSummary, createQuestions } from '@graphear/core';
import { Store, type Project } from './store';
import { learningRouter } from './learning/routes';
import type { AIConfig } from './ai/config';
import type { AIProvider } from './ai/providers';

class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
const hash = (token: string) => createHash('sha256').update(token).digest('hex');
const cookieToken = (req: Request) => {
  const raw = (req.headers.cookie ?? '')
    .split(';')
    .map((c) => c.trim())
    .find((c) => c.startsWith('graphear_session='))
    ?.split('=')[1];
  return raw && /^[a-f0-9]{64}$/.test(raw) ? raw : null;
};
const publicProject = (p: Project) => ({
  id: p.id,
  graph: p.graph,
  revision: p.revision,
  updatedAt: p.updatedAt,
  shareToken: p.shareToken,
});
export function createApp(
  store: Store,
  options: {
    origins?: string[];
    production?: boolean;
    serveWeb?: boolean;
    learning?: { config: AIConfig; provider?: AIProvider };
  } = {},
) {
  const app = express();
  app.disable('x-powered-by');
  const production = options.production ?? false;
  const origins = new Set(
    options.origins ?? [
      'http://127.0.0.1:5173',
      'http://localhost:5173',
      'http://127.0.0.1:3001',
      'http://localhost:3001',
    ],
  );
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'wasm-unsafe-eval'"],
          styleSrc: ["'self'"],
          styleSrcAttr: ["'unsafe-inline'"],
          fontSrc: ["'self'"],
          imgSrc: ["'self'", 'data:', 'blob:'],
          connectSrc: ["'self'"],
          workerSrc: ["'self'", 'blob:'],
          objectSrc: ["'none'"],
          baseUri: ["'self'"],
          frameAncestors: ["'none'"],
          frameSrc: ["'self'", 'https://www.youtube-nocookie.com'],
          upgradeInsecureRequests: production ? [] : null,
        },
      },
      crossOriginEmbedderPolicy: false,
    }),
  );
  app.use('/api', (_req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    next();
  });
  app.use('/api', (req, res, next) => {
    const origin = req.headers.origin;
    if (origin && origins.has(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      res.setHeader('Vary', 'Origin');
    }
    if (req.method === 'OPTIONS') {
      if (!origin || !origins.has(origin))
        return res.status(403).json({ error: 'This website cannot access the workspace.' });
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type,X-CSRF-Token');
      res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
      return res.sendStatus(204);
    }
    next();
  });
  app.use('/api', (req, res, next) => {
    if (store.rate(hash(req.ip ?? 'unknown')) > 240) {
      res.setHeader('Retry-After', '60');
      return res.status(429).json({ error: 'Too many requests. Try again in one minute.' });
    }
    next();
  });
  app.use(express.json({ limit: '1mb', type: 'application/json' }));
  const requireOrigin = (req: Request) => {
    if (!req.headers.origin || !origins.has(req.headers.origin))
      throw new HttpError(403, 'This website cannot change the workspace.');
  };
  const session = (req: Request, mutation = false) => {
    const token = cookieToken(req);
    const owner = token ? hash(token) : '';
    const s = owner ? store.session(owner) : null;
    if (!s) throw new HttpError(401, 'Open a workspace before saving a diagram.');
    if (mutation) {
      requireOrigin(req);
      const csrf = req.header('X-CSRF-Token') ?? '';
      const a = Buffer.from(csrf);
      const b = Buffer.from(s.csrf);
      if (a.length !== b.length || !timingSafeEqual(a, b))
        throw new HttpError(403, 'Your workspace security token expired. Reload and try again.');
    }
    return owner;
  };
  const validId = (value: unknown) => {
    const result = z.uuid().safeParse(value);
    if (!result.success) throw new HttpError(400, 'Invalid project ID.');
    return result.data;
  };
  app.get('/api/health', (_req, res) =>
    res.json({ status: 'ok', version: '1.0.0', storage: 'sqlite' }),
  );
  app.post('/api/session', (req, res) => {
    requireOrigin(req);
    const existing = cookieToken(req);
    const existingSession = existing ? store.session(hash(existing)) : null;
    if (existingSession)
      return res.json({ csrfToken: existingSession.csrf, expiresAt: existingSession.expires });
    const token = randomBytes(32).toString('hex');
    const csrf = randomBytes(24).toString('hex');
    store.createSession(hash(token), csrf);
    res.setHeader(
      'Set-Cookie',
      `graphear_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=2592000${production ? '; Secure' : ''}`,
    );
    res.status(201).json({ csrfToken: csrf, expiresAt: Date.now() + 2592000_000 });
  });
  app.get('/api/projects', (req, res) => {
    const owner = session(req);
    res.json({
      projects: store.list(owner).map((p) => ({
        id: p.id,
        title: p.graph.title,
        description: p.graph.description,
        steps: p.graph.nodes.length,
        connections: p.graph.edges.length,
        revision: p.revision,
        updatedAt: p.updatedAt,
        shareToken: p.shareToken,
      })),
    });
  });
  app.get('/api/projects/:id', (req, res) => {
    const p = store.get(session(req), validId(req.params.id));
    if (!p) throw new HttpError(404, 'Diagram not found in your workspace.');
    res.json(publicProject(p));
  });
  app.post('/api/projects', (req, res) => {
    const owner = session(req, true);
    if (store.list(owner).length >= 50)
      throw new HttpError(
        422,
        'Your workspace holds 50 diagrams. Export or delete one before saving another.',
      );
    const input = z.object({ graph: z.unknown() }).strict().parse(req.body);
    res.status(201).json(publicProject(store.create(owner, parseGraph(input.graph))));
  });
  app.put('/api/projects/:id', (req, res) => {
    const owner = session(req, true);
    const id = validId(req.params.id);
    const body = z
      .object({ graph: z.unknown(), revision: z.number().int().min(1) })
      .strict()
      .parse(req.body);
    if (!store.get(owner, id)) throw new HttpError(404, 'Diagram not found in your workspace.');
    const updated = store.update(owner, id, parseGraph(body.graph), body.revision);
    if (!updated)
      throw new HttpError(
        409,
        'This diagram changed in another tab. Save a new copy or reload the latest version.',
      );
    res.json(publicProject(updated));
  });
  app.delete('/api/projects/:id', (req, res) => {
    if (!store.delete(session(req, true), validId(req.params.id)))
      throw new HttpError(404, 'Diagram not found in your workspace.');
    res.sendStatus(204);
  });
  app.post('/api/projects/:id/share', (req, res) => {
    const owner = session(req, true);
    const id = validId(req.params.id);
    const p = store.get(owner, id);
    if (!p) throw new HttpError(404, 'Diagram not found in your workspace.');
    if (analyzeGraph(p.graph).pendingReview > 0)
      throw new HttpError(422, 'Confirm the diagram structure before sharing it.');
    const token = randomBytes(24).toString('hex');
    store.publish(owner, id, token);
    res.status(201).json({ token, url: `/#share/${token}` });
  });
  app.delete('/api/projects/:id/share', (req, res) => {
    const owner = session(req, true);
    const id = validId(req.params.id);
    if (!store.get(owner, id)) throw new HttpError(404, 'Diagram not found in your workspace.');
    store.revoke(owner, id);
    res.sendStatus(204);
  });
  app.get('/api/shares/:token', (req, res) => {
    const token = String(req.params.token);
    if (!/^[a-f0-9]{48}$/.test(token))
      throw new HttpError(404, 'This shared diagram is unavailable.');
    const result = store.shared(token);
    if (!result) throw new HttpError(404, 'This shared diagram was removed or its link changed.');
    res.json(result);
  });
  app.post('/api/graphs/analyze', (req, res) => {
    session(req, true);
    const graph = parseGraph(z.object({ graph: z.unknown() }).strict().parse(req.body).graph);
    res.json({
      analysis: analyzeGraph(graph),
      summary: graphSummary(graph),
      questions: createQuestions(graph),
    });
  });
  const learning = learningRouter(
    store,
    session,
    options.learning?.config,
    options.learning?.provider,
  );
  app.locals.learning = learning.service;
  app.use('/api/learning', learning.router);
  app.use('/api', (_req, _res, next) => next(new HttpError(404, 'API endpoint not found.')));
  if (options.serveWeb) {
    const web = resolve('dist/web');
    if (existsSync(web)) {
      app.use(express.static(web, { index: 'index.html', maxAge: 0 }));
      app.get('/{*path}', (_req, res) => res.sendFile(resolve(web, 'index.html')));
    }
  }
  app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (error instanceof HttpError) return res.status(error.status).json({ error: error.message });
    if (error instanceof z.ZodError)
      return res.status(400).json({
        error: error.issues
          .map((i) => i.message)
          .slice(0, 3)
          .join('. '),
      });
    if (error instanceof SyntaxError)
      return res.status(400).json({ error: 'Invalid JSON. Import a valid Graphear diagram.' });
    if (
      typeof error === 'object' &&
      error !== null &&
      'type' in error &&
      error.type === 'entity.too.large'
    )
      return res.status(413).json({ error: 'Diagram is too large. Maximum request size is 1 MB.' });
    if (
      error instanceof Error &&
      /Duplicate|Missing node|bounds|Expected|Invalid|Too big|Too small|Unrecognized/.test(
        error.message,
      )
    )
      return res.status(400).json({ error: error.message });
    return res
      .status(500)
      .json({ error: 'The workspace could not complete this request. Try again.' });
  });
  return app;
}
