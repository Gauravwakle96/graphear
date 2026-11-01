import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { randomBytes, createHash } from 'node:crypto';
import { mkdtemp } from 'node:fs/promises';
import { join } from 'node:path';
import { PDFDocument } from 'pdf-lib';
import { unzipSync } from 'fflate';
import { Store } from '../apps/api/src/store';
import { LearningStore } from '../apps/api/src/learning/store';
import { testAnalysis, testSources } from '../packages/core/src/study.test-support';

// Explicit test fixtures are seeded only into this isolated verification database.
// Requests run through the actual Node production bundle, with no AI credentials.
const directory = await mkdtemp('data/export-smoke-');
const path = join(directory, 'test.sqlite');
const token = randomBytes(32).toString('hex');
const owner = createHash('sha256').update(token).digest('hex');
const base = new Store(path);
base.createSession(owner, randomBytes(24).toString('hex'));
const store = new LearningStore(base);
const session = store.create(
  owner,
  {
    kind: 'text',
    name: 'Explicit production export test fixture',
    text: testSources[0].text,
    path: null,
    mime: null,
    url: null,
    videoId: null,
    duration: null,
    embed: false,
  },
  {
    subject: 'Networks',
    consent: true,
    noteStyle: 'detailed',
    difficulty: 'medium',
    questionCount: 1,
  },
  168,
  false,
);
session.sources = testSources;
session.analysis = testAnalysis();
session.status = 'completed';
store.write(session);
base.close();
const origin = 'http://127.0.0.1:3182';
const child = spawn(process.execPath, ['dist/server.mjs'], {
  stdio: ['ignore', 'ignore', 'inherit'],
  env: {
    ...process.env,
    GRAPHEAR_LOAD_ENV: '0',
    NODE_ENV: 'production',
    PORT: '3182',
    HOST: '127.0.0.1',
    DATABASE_PATH: path,
    LEARNING_UPLOAD_DIR: join(directory, 'uploads'),
    ALLOWED_ORIGINS: origin,
    APP_PUBLIC_URL: '',
    RENDER_EXTERNAL_URL: '',
    OPENAI_API_KEY: '',
    GEMINI_API_KEY: '',
    AI_PROVIDER: 'openai',
    YOUTUBE_API_KEY: '',
    YOUTUBE_OAUTH_TOKEN: '',
    PROXY_TRUST_HOPS: '0',
  },
});
try {
  let ready = false;
  for (let i = 0; i < 100; i++) {
    try {
      if ((await fetch(origin + '/api/health')).ok) {
        ready = true;
        break;
      }
    } catch {
      /* Wait for this server. */
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  assert(ready, 'Production export server did not start');
  for (const format of ['pdf', 'docx', 'flashcards', 'package']) {
    const url = origin + '/api/learning/' + session.id + '/export/' + format;
    assert.equal((await fetch(url)).status, 401, 'Exports must remain private');
    const response = await fetch(url, { headers: { Cookie: 'graphear_session=' + token } });
    assert.equal(response.status, 200, format + ' production export');
    assert.match(response.headers.get('content-disposition') ?? '', /attachment/);
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (format === 'pdf' || format === 'flashcards')
      assert((await PDFDocument.load(bytes)).getPageCount() > 0);
    else {
      const entries = unzipSync(bytes);
      if (format === 'docx') assert(entries['word/document.xml']);
      else assert(Object.keys(entries).some((name) => name.endsWith('.svg')));
    }
  }
  console.log(
    'PASS production exports: private PDF, DOCX, flashcards and study ZIP are parseable through the built Node server. Explicit synthetic fixture; no AI calls.',
  );
} finally {
  child.kill();
}
