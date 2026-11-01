import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { testAnalysis, testSources } from '../packages/core/src/study.test-support';
import type { LearningSession } from '../apps/web/src/lib/learning-api';
const fixtureId = '6a29e291-4855-412f-9dc3-e6db567b6a77';
function session(): LearningSession {
  return {
    id: fixtureId,
    title: 'Synthetic learning test fixture',
    status: 'completed',
    progress: 100,
    message: 'Test fixture only',
    error: null,
    revision: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    assetExpiresAt: Date.now() + 86400000,
    input: {
      kind: 'text',
      name: 'Synthetic source',
      mime: null,
      text: testSources[0].text,
      url: null,
      videoId: null,
      duration: null,
      embed: false,
    },
    options: {
      subject: 'Computer networks',
      difficulty: 'medium',
      questionCount: 1,
      noteStyle: 'detailed',
      consent: true,
    },
    sources: testSources,
    analysis: testAnalysis(),
    chat: [],
    quizAttempts: [],
    hasFile: false,
    fileUrl: null,
  };
}
async function prepared(page: Page, initial = session()) {
  let current = initial;
  await page.route('**/api/learning/config', (r) =>
    r.fulfill({
      json: {
        provider: 'test fixture',
        model: 'test-only',
        configured: true,
        captionsConfigured: false,
        limits: {
          uploadMB: 100,
          documentMB: 20,
          mediaMinutes: 30,
          pdfPages: 50,
          retentionHours: 168,
        },
        privacy: 'Synthetic test fixture',
      },
    }),
  );
  await page.route('**/api/learning', (r) =>
    r.request().method() === 'GET'
      ? r.fulfill({ json: { sessions: [{ ...current, category: 'network' }] } })
      : r.fulfill({ status: 201, json: current }),
  );
  await page.route(`**/api/learning/${fixtureId}`, async (r) => {
    if (r.request().method() === 'PATCH') {
      const patch = r.request().postDataJSON();
      current = { ...current, ...patch, revision: current.revision + 1 };
    }
    await r.fulfill({ json: current });
  });
  await page.route(`**/api/learning/${fixtureId}/chat`, async (r) => {
    const question = r.request().postDataJSON().question;
    current = {
      ...current,
      chat: [
        {
          id: 'test-message',
          question,
          result: {
            answer: 'The client sends the request.',
            evidence: ['text0'],
            additionalExplanation: false,
            uncertain: false,
            diagram: null,
          },
          createdAt: new Date().toISOString(),
        },
      ] as never,
    };
    await r.fulfill({ json: current });
  });
  await page.route(`**/api/learning/${fixtureId}/quiz`, async (r) => {
    current = {
      ...current,
      quizAttempts: [
        {
          id: 'attempt',
          createdAt: new Date().toISOString(),
          correct: 1,
          total: 1,
          answers: { q1: 'Client' },
        },
      ] as never,
    };
    await r.fulfill({ json: current });
  });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/#learning');
  await page.getByRole('button', { name: /Synthetic learning test fixture completed/ }).click();
  await expect(page.getByRole('heading', { name: 'Client-server communication' })).toBeVisible();
}
test('real unconfigured server allows private drafts but makes no AI success claim', async ({
  page,
}) => {
  await page.goto('/#learning');
  await expect(
    page.getByText('AI processing is not configured yet.', { exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Paste text', exact: true }).click();
  await page
    .getByLabel('Educational content', { exact: true })
    .fill('A client sends a request to a server.');
  await page.getByLabel(/I’m authorized/).check();
  await page.getByRole('button', { name: 'Save source draft', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Your source is saved' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Process material', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Delete session', exact: true }).click();
  await page.getByRole('button', { name: 'Delete permanently' }).click();
  await expect(page.getByRole('heading', { name: 'Learning studio', exact: true })).toBeVisible();
});
test('test-fixture notes preserve citations, editing and private save state', async ({ page }) => {
  await prepared(page);
  await page.getByRole('button', { name: 'Edit notes', exact: true }).click();
  await page
    .getByRole('textbox', { name: 'Note 1', exact: true })
    .fill('The client sends the first request.');
  await expect(page.getByText('Unsaved edits', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Save changes', exact: true }).click();
  await expect(page.getByText('Session changes saved.', { exact: true })).toBeVisible();
  await page.screenshot({ path: '.impeccable/review/learning-notes-fixture.png', fullPage: true });
  await page.getByRole('button', { name: 'Text section 1', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Text section 1', exact: true })).toBeFocused();
  await expect(page.getByRole('heading', { name: 'Extracted source content' })).toBeVisible();
  await page.screenshot({ path: '.impeccable/review/learning-source-fixture.png', fullPage: true });
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});
test('test-fixture diagrams support keyboard editing, notation and PNG export', async ({
  page,
}) => {
  await prepared(page);
  await page.getByRole('button', { name: 'Diagrams', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Client and server', exact: true })).toBeVisible();
  await page.getByLabel('Label', { exact: true }).fill('Client browser');
  await page.getByLabel('Horizontal position', { exact: true }).fill('120');
  await page.getByRole('button', { name: 'Save changes', exact: true }).click();
  await page.getByRole('button', { name: 'Notation', exact: true }).click();
  await expect(page.locator('.study-notation svg')).toBeVisible();
  const svg = await page.locator('.study-notation svg').evaluate((element) => element.outerHTML);
  const labels = await page.evaluate(
    (svg) =>
      Array.from(
        new DOMParser().parseFromString(svg, 'image/svg+xml').querySelectorAll('.nodes text'),
      )
        .map((n) => n.textContent)
        .join(' '),
    svg,
  );
  expect(labels).toContain('Client browser');
  expect(svg).toContain('Server');
  expect(svg).not.toContain('foreignObject');
  const lettering = await page
    .locator('.study-notation svg .nodes text')
    .first()
    .evaluate((element) => {
      const text = element as SVGTextElement;
      const style = text.style.fontFamily;
      const manrope = text.getComputedTextLength();
      text.style.fontFamily = 'Arial';
      const fallback = text.getComputedTextLength();
      text.style.fontFamily = style;
      return {
        loaded: document.fonts.check('16px Manrope'),
        family: getComputedStyle(text).fontFamily,
        difference: Math.abs(manrope - fallback),
      };
    });
  expect(lettering.loaded).toBe(true);
  expect(lettering.family).toContain('Manrope');
  expect(lettering.difference).toBeGreaterThan(0.5);
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'PNG', exact: true }).click();
  expect((await download).suggestedFilename()).toBe('diagram.png');
  await page.screenshot({
    path: '.impeccable/review/learning-diagram-fixture.png',
    fullPage: true,
  });
});
test('test-fixture tutor, flashcards and quiz explanations are interactive', async ({ page }) => {
  await prepared(page);
  await page.getByRole('button', { name: 'AI tutor', exact: true }).click();
  await page.getByLabel('Your question', { exact: true }).fill('Who sends the request?');
  await page.getByRole('button', { name: 'Ask tutor', exact: true }).click();
  await expect(page.getByText('The client sends the request.', { exact: true })).toBeVisible();
  await page.screenshot({ path: '.impeccable/review/learning-tutor-fixture.png', fullPage: true });
  await page.getByRole('button', { name: 'Revision', exact: true }).click();
  await page.getByRole('button', { name: 'Reveal answer', exact: true }).click();
  await expect(page.getByText('The client.', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Practice test', exact: true }).click();
  await page.getByLabel('Client', { exact: true }).check();
  await page.getByRole('button', { name: 'Check answers and save attempt' }).click();
  await expect(page.getByText('Correct', { exact: true })).toBeVisible();
  await expect(page.getByText(/1\/1 automatically checked answers/)).toBeVisible();
});
test('learning layouts at desktop, tablet and mobile retain themes and accessible controls', async ({
  page,
}) => {
  await page.goto('/#learning');
  await expect(page.getByRole('heading', { name: 'What are you learning today?' })).toBeVisible();
  for (const [name, width] of [
    ['desktop', 1440],
    ['tablet', 820],
    ['mobile', 390],
  ] as const) {
    await page.setViewportSize({ width, height: 900 });
    if ((await page.locator('html').getAttribute('data-theme')) !== 'light')
      await page.getByRole('button', { name: 'Switch to light theme', exact: true }).click();
    await expect(page.getByRole('button', { name: 'New session', exact: true })).toHaveCSS(
      'background-color',
      'rgb(255, 255, 255)',
    );
    await page.waitForTimeout(250);
    await page.screenshot({ path: `.impeccable/review/learning-${name}.png`, fullPage: true });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    if ((await page.locator('html').getAttribute('data-theme')) !== 'dark')
      await page.getByRole('button', { name: 'Switch to dark theme', exact: true }).click();
    await expect(page.getByRole('button', { name: 'New session', exact: true })).toHaveCSS(
      'background-color',
      'rgb(28, 48, 39)',
    );
    await page.waitForTimeout(250);
    await page.screenshot({ path: `.impeccable/review/learning-${name}-dark.png`, fullPage: true });
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  }
});

test('unsaved learning edits survive side navigation, footer links and hash changes until discarded', async ({
  page,
}) => {
  await prepared(page);
  await page.getByRole('button', { name: 'Edit notes', exact: true }).click();
  const note = page.getByRole('textbox', { name: 'Note 1', exact: true });
  await note.fill('Keep this unsaved learning edit.');
  await page.getByRole('link', { name: 'Skip to main content', exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#main-content')).toBeFocused();
  await expect(note).toHaveValue('Keep this unsaved learning edit.');
  await page.getByRole('link', { name: 'Library', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Leave without saving?' })).toBeVisible();
  await page.screenshot({
    path: '.impeccable/review/learning-unsaved-fixture.png',
    fullPage: true,
  });
  await page.getByRole('button', { name: 'Keep editing', exact: true }).click();
  await expect(note).toHaveValue('Keep this unsaved learning edit.');
  await page.getByRole('link', { name: 'Accessibility guide', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Leave without saving?' })).toBeVisible();
  await expect(page).toHaveURL(/#learning$/);
  await page.getByRole('button', { name: 'Keep editing', exact: true }).click();
  await page.evaluate(() => {
    window.location.hash = 'library';
  });
  await expect(page.getByRole('dialog', { name: 'Leave without saving?' })).toBeVisible();
  await expect(note).toHaveValue('Keep this unsaved learning edit.');
  await page.getByRole('button', { name: 'Discard edits and leave', exact: true }).click();
  await expect(
    page
      .getByRole('navigation', { name: 'Main navigation' })
      .getByRole('link', { name: 'Library', exact: true }),
  ).toHaveAttribute('aria-current', 'page');
});

test('source citations focus their heading and seek uploaded audio after metadata loads', async ({
  page,
}) => {
  const current = session();
  current.sources = [
    {
      ...current.sources[0],
      kind: 'audio',
      reference: 'Recording interval 1',
      start: 1.25,
      end: 3,
    },
    {
      ...current.sources[0],
      id: 'text1',
      kind: 'audio',
      reference: 'Recording interval 2',
      start: 4.5,
      end: 6,
    },
  ];
  current.input = { ...current.input, kind: 'file', mime: 'audio/wav', duration: 8 };
  current.hasFile = true;
  current.fileUrl = `/api/learning/${fixtureId}/file`;
  const samples = 8000 * 8;
  const wav = Buffer.alloc(44 + samples * 2);
  wav.write('RIFF', 0);
  wav.writeUInt32LE(wav.length - 8, 4);
  wav.write('WAVEfmt ', 8);
  wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(1, 20);
  wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(8000, 24);
  wav.writeUInt32LE(16000, 28);
  wav.writeUInt16LE(2, 32);
  wav.writeUInt16LE(16, 34);
  wav.write('data', 36);
  wav.writeUInt32LE(samples * 2, 40);
  await page.route(`**${current.fileUrl}`, (route) => {
    const range = /^bytes=(\d+)-(\d*)$/.exec(route.request().headers().range ?? '');
    const start = range ? Number(range[1]) : 0;
    const end = range?.[2] ? Math.min(Number(range[2]), wav.length - 1) : wav.length - 1;
    const body = wav.subarray(start, end + 1);
    return route.fulfill({
      status: range ? 206 : 200,
      body,
      contentType: 'audio/wav',
      headers: {
        'Accept-Ranges': 'bytes',
        'Content-Length': String(body.length),
        ...(range ? { 'Content-Range': `bytes ${start}-${end}/${wav.length}` } : {}),
      },
    });
  });
  await prepared(page, current);
  await page.getByRole('button', { name: 'Recording interval 1', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Recording interval 1', exact: true }),
  ).toBeFocused();
  await expect
    .poll(() => page.locator('audio').evaluate((media) => (media as HTMLAudioElement).currentTime))
    .toBeCloseTo(1.25, 2);
  await page.getByRole('button', { name: /Recording interval 2/ }).click();
  await expect(
    page.getByRole('heading', { name: 'Recording interval 2', exact: true }),
  ).toBeFocused();
  await expect
    .poll(() => page.locator('audio').evaluate((media) => (media as HTMLAudioElement).currentTime))
    .toBeCloseTo(4.5, 2);
  await page.screenshot({ path: '.impeccable/review/learning-media-fixture.png', fullPage: true });
});
