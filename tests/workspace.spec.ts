import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFile, mkdir } from 'node:fs/promises';
import { scholarshipGraph } from '../packages/core/src/index';
test.beforeEach(async ({ page }) => {
  await page.goto('/');
});
test('follows both branches and retraces the route', async ({ page }) => {
  const explorer = page.getByRole('complementary', { name: 'Accessible diagram explorer' });
  await explorer.getByRole('button', { name: /Continue Enrolled/ }).click();
  await expect(explorer.getByRole('heading', { name: 'Enrolled student?' })).toBeVisible();
  await explorer.getByRole('button', { name: /No Not eligible/ }).click();
  await expect(explorer.getByText('You reached an outcome.')).toBeVisible();
  await explorer.getByRole('button', { name: 'Back a step' }).click();
  await explorer.getByRole('button', { name: /Yes Income/ }).click();
  await expect(explorer.getByRole('heading', { name: /Income under/ })).toBeVisible();
});
test('branch activation keeps keyboard focus in the updated explorer', async ({ page }) => {
  const explorer = page.getByRole('complementary', { name: 'Accessible diagram explorer' });
  await explorer.getByRole('button', { name: /Continue Enrolled/ }).focus();
  await page.keyboard.press('Enter');
  await expect(
    explorer.getByRole('heading', { name: 'Enrolled student?', exact: true }),
  ).toBeFocused();
  await page.screenshot({ path: '.impeccable/review/keyboard-enter.png', fullPage: true });
  await page.keyboard.press('Tab');
  await expect(explorer.getByRole('button', { name: /Yes Income/ })).toBeFocused();
  await page.screenshot({ path: '.impeccable/review/keyboard-next.png', fullPage: true });
  await page.keyboard.press('Enter');
  await expect(explorer.getByRole('heading', { name: /Income under/ })).toBeFocused();
});
test('hidden visual mode keeps sequential headings and text exploration', async ({ page }) => {
  await page.getByRole('button', { name: 'Hide visual diagram' }).click();
  await expect(
    page.getByRole('heading', { name: 'Focus on the structure', level: 2 }),
  ).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page
    .getByRole('complementary', { name: 'Accessible diagram explorer' })
    .getByRole('button', { name: /Continue Enrolled/ })
    .click();
  await expect(page.getByRole('heading', { name: 'Enrolled student?', exact: true })).toBeFocused();
});
test('original source can be enlarged and inspected with keyboard', async ({ page }) => {
  await page.getByRole('button', { name: 'Review source', exact: true }).click();
  await page.getByRole('button', { name: 'Enlarge original source' }).click();
  const dialog = page.getByRole('dialog', { name: 'Inspect original source' });
  const slider = dialog.getByRole('slider', { name: /Source zoom/ });
  await slider.focus();
  await page.keyboard.press('ArrowRight');
  await expect(slider).toHaveValue('1.25');
  await page.keyboard.press('Tab');
  await expect(dialog.getByRole('region', { name: /Enlarged source diagram/ })).toBeFocused();
  await page.screenshot({ path: '.impeccable/review/source-inspector.png', fullPage: true });
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Enlarge original source' })).toBeFocused();
});
test('edits a node, compares, undoes and selects a newly created node', async ({ page }) => {
  await page.getByRole('button', { name: 'Edit', exact: true }).click();
  await page.getByLabel('Step label', { exact: true }).fill('Begin scholarship');
  await page.getByRole('button', { name: 'Apply step changes' }).click();
  await page.getByRole('button', { name: 'Compare', exact: true }).click();
  await expect(page.getByText('Step changed', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Undo edit' }).click();
  await expect(page.getByText('The versions match')).toBeVisible();
  await page.getByRole('button', { name: 'Edit', exact: true }).click();
  await page.getByLabel('New step label').fill('Counsellor review');
  await page.getByRole('button', { name: 'Add step', exact: true }).click();
  await expect(page.getByLabel('Step label', { exact: true })).toHaveValue('Counsellor review');
});
test('repairs the approval path with grounded feedback', async ({ page }) => {
  await page.getByRole('link', { name: 'Practice', exact: true }).click();
  await page.getByRole('button', { name: 'Start repair mission' }).click();
  await page.getByRole('button', { name: 'Check repair' }).click();
  await expect(page.getByText(/Connect “Verify documents”/)).toBeVisible();
  await page.getByRole('combobox', { name: 'Connect to', exact: true }).selectOption('approved');
  await page.getByLabel('Connection label', { exact: true }).fill('Complete');
  await page.getByRole('button', { name: 'Add connection', exact: true }).click();
  await page.getByRole('button', { name: 'Check repair' }).click();
  await expect(page.getByText(/Mission complete/)).toBeVisible();
});
test('SVG imports require explicit review; active SVG content is rejected', async ({ page }) => {
  const svg = await readFile('apps/web/public/examples/scholarship.svg');
  await page
    .locator('input[type=file]')
    .first()
    .setInputFiles({ name: 'flow.svg', mimeType: 'image/svg+xml', buffer: svg });
  await expect(page.getByRole('heading', { name: 'Check the source' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Confirm reviewed structure' })).toBeDisabled();
  await page.getByLabel('I have checked').check();
  await page.getByRole('button', { name: 'Confirm reviewed structure' }).click();
  await expect(page.getByText('Confirmed structure', { exact: true })).toBeVisible();
  await page
    .locator('input[type=file]')
    .first()
    .setInputFiles({
      name: 'bad.svg',
      mimeType: 'image/svg+xml',
      buffer: Buffer.from(
        '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>',
      ),
    });
  await expect(page.getByText(/contains active or embedded content/)).toBeVisible();
  await expect(page.getByRole('heading', { name: 'flow', exact: true })).toBeVisible();
});
test('saves locally and to the API, creates an immutable link and revokes it', async ({
  page,
  context,
}) => {
  await page.getByRole('button', { name: 'Save diagram', exact: true }).click();
  let dialog = page.getByRole('dialog', { name: 'Save your diagram' });
  await dialog.getByLabel('Diagram title').fill('Local test');
  await dialog.getByRole('button', { name: 'Save diagram', exact: true }).click();
  await page.getByRole('link', { name: 'Library', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Local test' })).toBeVisible();
  await page.getByRole('button', { name: /Local test.*On this device/ }).click();
  await page.getByRole('button', { name: 'Save diagram', exact: true }).click();
  dialog = page.getByRole('dialog', { name: 'Save your diagram' });
  await dialog.getByLabel('Diagram title').fill('Private test');
  await dialog.getByRole('radio', { name: /Private guest workspace/ }).check();
  await dialog.getByRole('button', { name: 'Save diagram', exact: true }).click();
  await page.getByRole('button', { name: 'Share read-only diagram' }).click();
  const sharing = page.getByRole('dialog', { name: 'Share a read-only diagram' });
  await sharing.getByRole('button', { name: 'Create read-only link' }).click();
  const link = await sharing.getByLabel('Read-only link').inputValue();
  const viewer = await context.newPage();
  await viewer.goto(link);
  await expect(viewer.getByRole('heading', { name: 'Private test', exact: true })).toBeVisible();
  await expect(viewer.getByRole('button', { name: 'Edit', exact: true })).toHaveCount(0);
  await sharing.getByRole('button', { name: 'Revoke link' }).click();
  await viewer.reload();
  await expect(viewer.getByRole('heading', { name: 'Shared diagram unavailable' })).toBeVisible();
});
test('real raster OCR yields a reviewable draft without uploading image pixels', async ({
  page,
}) => {
  test.setTimeout(120_000);
  const image = await page.evaluate(() => {
    const c = document.createElement('canvas');
    c.width = 800;
    c.height = 500;
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, 800, 500);
    ctx.font = '30px Arial';
    ctx.fillStyle = '#000000';
    for (const [label, y] of [
      ['Start application', 80],
      ['Verify documents', 230],
      ['Application approved', 380],
    ] as const) {
      ctx.strokeRect(160, y - 40, 480, 65);
      ctx.fillText(label, 200, y);
    }
    return c.toDataURL('image/png').split(',')[1];
  });
  const apiMutations: string[] = [];
  page.on('request', (r) => {
    if (r.url().includes('/api/') && r.method() !== 'GET') apiMutations.push(r.url());
  });
  await page
    .locator('input[type=file]')
    .first()
    .setInputFiles({
      name: 'synthetic-ocr.png',
      mimeType: 'image/png',
      buffer: Buffer.from(image, 'base64'),
    });
  await expect(page.getByRole('heading', { name: 'Check the source' })).toBeVisible({
    timeout: 90_000,
  });
  await expect(page.getByText(/geometric suggestions, not verified arrow/)).toBeVisible();
  expect(apiMutations).toEqual([]);
  let uploads = 0;
  page.on('request', (r) => {
    if (r.url().endsWith('/api/learning') && r.method() === 'POST') uploads++;
  });
  await page.getByRole('button', { name: 'Open AI reconstruction', exact: true }).click();
  await expect(page.getByText('Your original image is ready.', { exact: false })).toBeVisible();
  await page.getByLabel('Diagram format', { exact: true }).selectOption('network');
  await page.getByLabel('Diagram detail', { exact: true }).selectOption('simple');
  await page
    .getByLabel('Tell the AI what you need', { exact: true })
    .fill('Keep every layer and label in order');
  await expect(page.getByLabel(/I’m authorized/)).not.toBeChecked();
  expect(uploads).toBe(0);
});
test('rejects invalid graph references and exports a portable learning pack', async ({ page }) => {
  const bad = { ...scholarshipGraph, edges: [{ ...scholarshipGraph.edges[0], target: 'missing' }] };
  await page
    .locator('input[type=file]')
    .first()
    .setInputFiles({
      name: 'bad.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(bad)),
    });
  await expect(page.getByText(/Missing node/)).toBeVisible();
  await page.locator('.export-menu summary').click();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'HTML learning pack' }).click();
  const exported = await download;
  expect(exported.suggestedFilename()).toMatch(/learning-pack\.html$/);
});
for (const [name, width, height] of [
  ['desktop', 1440, 900],
  ['tablet', 768, 1024],
  ['mobile', 390, 844],
] as const) {
  test(`keyboard, contrast and layout on ${name}, light and dark`, async ({ page }) => {
    await mkdir('.impeccable/review', { recursive: true });
    await page.setViewportSize({ width, height });
    await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' });
    await page.reload();
    await page.keyboard.press('Tab');
    await expect(page.getByRole('link', { name: 'Skip to main content' })).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.locator('#main-content')).toBeFocused();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    ).toBeTruthy();
    await page.locator('body').click({ position: { x: 2, y: 2 } });
    await page.evaluate(() => document.fonts.ready);
    const labelSize = await page
      .locator('.edge-label')
      .first()
      .evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
    expect(labelSize).toBeGreaterThanOrEqual(12);
    const light = await new AxeBuilder({ page }).analyze();
    expect(light.violations).toEqual([]);
    await page.screenshot({ path: `.impeccable/review/${name}.png`, fullPage: true });
    await page.getByRole('button', { name: 'Switch to dark theme' }).click();
    const dark = await new AxeBuilder({ page }).analyze();
    expect(dark.violations).toEqual([]);
    await page.screenshot({ path: `.impeccable/review/${name}-dark.png`, fullPage: true });
  });
}
