import { spawn } from 'node:child_process';
import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
const origin = 'http://127.0.0.1:3002';
const child = spawn(process.execPath, ['dist/server.mjs'], {
  stdio: ['ignore', 'ignore', 'inherit'],
  env: {
    ...process.env,
    PORT: '3002',
    HOST: '127.0.0.1',
    NODE_ENV: 'production',
    DATABASE_PATH: 'data/smoke.sqlite',
    ALLOWED_ORIGINS: origin,
  },
});
let browser;
try {
  let ready = false;
  for (let i = 0; i < 50; i++) {
    try {
      const response = await fetch(origin + '/api/health');
      if (response.ok) {
        ready = true;
        break;
      }
    } catch {
      /* wait for startup */
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  assert(ready, 'Production server did not start');
  const response = await fetch(origin);
  assert(response.headers.get('content-security-policy')?.includes("default-src 'self'"));
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
  browser = await chromium.launch({ channel: process.env.CI ? undefined : 'chrome' });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    colorScheme: 'light',
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(origin);
  await page.getByRole('heading', { name: 'Scholarship application', exact: true }).waitFor();
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await page.getByRole('heading', { name: 'Scholarship application', exact: true }).waitFor();
  await page.getByRole('button', { name: 'Share read-only diagram' }).click();
  await page.getByRole('button', { name: 'Create read-only link', exact: true }).click();
  await page.getByLabel('Read-only link').waitFor();
  const cookies = await context.cookies();
  const session = cookies.find((c) => c.name === 'graphear_session');
  assert(
    session?.httpOnly && session.secure && session.sameSite === 'Strict',
    'Production cookie flags',
  );
  await page.getByRole('dialog').getByRole('button', { name: 'Close dialog' }).click();
  await mkdir('.impeccable/review', { recursive: true });
  await page.getByRole('button', { name: 'Save diagram', exact: true }).click();
  await page.screenshot({ path: '.impeccable/review/save-dialog.png', fullPage: true });
  await page.getByRole('dialog').getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.getByRole('link', { name: 'Library', exact: true }).click();
  await page.getByRole('heading', { name: 'Scholarship application', exact: true }).waitFor();
  await page.screenshot({ path: '.impeccable/review/library.png', fullPage: true });
  await page.getByRole('link', { name: 'Practice', exact: true }).click();
  await page.screenshot({ path: '.impeccable/review/practice.png', fullPage: true });
  await page.getByRole('link', { name: 'Workspace', exact: true }).click();
  await page.getByRole('button', { name: 'Review source', exact: true }).click();
  await page.screenshot({ path: '.impeccable/review/review.png', fullPage: true });
  await page.getByRole('button', { name: 'Explore', exact: true }).click();
  await page.evaluate(async () => {
    await document.fonts.ready;
  });
  await page.screenshot({ path: '.impeccable/review/production-desktop.png', fullPage: true });
  await context.setOffline(true);
  await page.reload();
  await page.getByRole('heading', { name: 'Scholarship application', exact: true }).waitFor();
  const explorer = page.getByRole('complementary', { name: 'Accessible diagram explorer' });
  await explorer.getByRole('button', { name: /Continue Enrolled/ }).click();
  await explorer.getByRole('heading', { name: 'Enrolled student?', exact: true }).waitFor();
  const cachedApi = await page.evaluate(async () => {
    const keys = await caches.keys();
    const urls = [];
    for (const key of keys) {
      const cache = await caches.open(key);
      urls.push(...(await cache.keys()).map((r) => r.url));
    }
    return urls.filter((u) => new URL(u).pathname.startsWith('/api'));
  });
  assert.deepEqual(cachedApi, [], 'Private API responses must never be cached');
  await context.setOffline(false);
  const raster = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 800;
    canvas.height = 300;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, 800, 300);
    ctx.fillStyle = '#000';
    ctx.font = '32px Arial';
    ctx.fillText('Start application', 150, 80);
    ctx.fillText('Verify documents', 150, 210);
    return canvas.toDataURL('image/png').split(',')[1];
  });
  await page
    .locator('input[type=file]')
    .first()
    .setInputFiles({
      name: 'production-ocr.png',
      mimeType: 'image/png',
      buffer: Buffer.from(raster, 'base64'),
    });
  await page
    .getByRole('heading', { name: 'Check the source', exact: true })
    .waitFor({ timeout: 60_000 });
  await page.getByText(/geometric suggestions, not verified arrow/).waitFor();
  assert.deepEqual(errors, [], 'No runtime exceptions');
  console.log(
    'PASS production: static frontend, CSP/headers, Secure HttpOnly SameSite cookie, share creation, offline reload/navigation, real raster OCR under CSP, no cached API or runtime exceptions.',
  );
} finally {
  if (browser) await browser.close();
  child.kill();
}
