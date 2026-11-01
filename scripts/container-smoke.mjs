import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { randomUUID } from 'node:crypto';
const exec = promisify(execFile);
const docker = async (...args) =>
  (await exec('docker', args, { maxBuffer: 2_000_000 })).stdout.trim();
const suffix = randomUUID().slice(0, 8);
const name = 'graphear-ci-' + suffix;
const volume = name + '-data';
const base = 'http://127.0.0.1:3016';
const headers = { Origin: base, 'Content-Type': 'application/json' };
async function ready() {
  for (let i = 0; i < 120; i++) {
    try {
      const response = await fetch(base + '/api/health', { signal: AbortSignal.timeout(2000) });
      if (response.ok) return;
    } catch {
      /* Wait only for this owned test container. */
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error('Container did not become healthy');
}
async function guest() {
  const r = await fetch(base + '/api/session', { method: 'POST', headers });
  assert.equal(r.status, 201);
  assert.match(r.headers.get('set-cookie'), /HttpOnly; SameSite=Strict.*Secure/);
  return {
    ...headers,
    Cookie: r.headers.get('set-cookie').split(';')[0],
    'X-CSRF-Token': (await r.json()).csrfToken,
  };
}
async function start() {
  await docker(
    'run',
    '-d',
    '--name',
    name,
    '--cap-drop',
    'ALL',
    '--security-opt',
    'no-new-privileges:true',
    '-p',
    '127.0.0.1:3016:3001',
    '--mount',
    `type=volume,source=${volume},target=/app/data`,
    '-e',
    `APP_PUBLIC_URL=${base}`,
    '-e',
    'AI_PROVIDER=openai',
    '-e',
    'OPENAI_API_KEY=',
    '-e',
    'GEMINI_API_KEY=',
    '-e',
    'LEARNING_UPLOAD_DIR=/app/data/learning',
    'graphear:verify',
  );
  await ready();
}
try {
  await docker('volume', 'create', volume);
  await start();
  assert.equal(await docker('exec', name, 'id', '-u'), '1000', 'Runtime must be non-root');
  const page = await fetch(base);
  assert.equal(page.status, 200);
  assert.match(page.headers.get('content-security-policy'), /default-src 'self'/);
  assert.match(await page.text(), /Graphear/);
  const first = await guest();
  const configured = await fetch(base + '/api/learning/config', { headers: first });
  assert.equal(
    (await configured.json()).configured,
    false,
    'CI must not use personal API credentials',
  );
  const created = await fetch(base + '/api/learning', {
    method: 'POST',
    headers: first,
    body: JSON.stringify({
      kind: 'text',
      title: 'Container persistence verification',
      text: 'A client sends a request to a server.',
      process: false,
      options: {
        subject: 'Networks',
        difficulty: 'medium',
        questionCount: 3,
        noteStyle: 'detailed',
        consent: true,
      },
    }),
  });
  assert.equal(created.status, 201);
  const study = await created.json();
  const outsider = await guest();
  assert.equal(
    (await fetch(base + '/api/learning/' + study.id, { headers: outsider })).status,
    404,
  );
  assert.equal(
    (
      await fetch(base + '/api/session', {
        method: 'POST',
        headers: { ...headers, Origin: 'https://evil.example', Host: 'evil.example' },
      })
    ).status,
    403,
  );
  assert.match(await docker('exec', name, 'ffmpeg', '-version'), /ffmpeg version/);
  assert.match(await docker('exec', name, 'ffprobe', '-version'), /ffprobe version/);
  await docker('stop', '--time', '30', name);
  await docker('rm', name);
  await start();
  const reloaded = await fetch(base + '/api/learning/' + study.id, { headers: first });
  assert.equal(
    reloaded.status,
    200,
    'Private session and source survive replacement of the container',
  );
  assert.equal((await reloaded.json()).input.text, 'A client sends a request to a server.');
  console.log(
    'PASS Linux container: non-root runtime, media tools, frontend/CSP, cookie/origin/owner boundaries, private session persistence across container replacement. No AI calls.',
  );
} catch (error) {
  console.error(
    await docker('logs', '--tail', '40', name).catch(() => 'Container logs unavailable'),
  );
  throw error;
} finally {
  // Only uniquely named fixtures created by this run are removed.
  await docker('rm', '-f', name).catch(() => undefined);
  await docker('volume', 'rm', volume).catch(() => undefined);
}
