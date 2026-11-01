import { mkdir, copyFile, readdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
const dest = resolve('apps/web/public/ocr');
await mkdir(dest, { recursive: true });
await copyFile('node_modules/tesseract.js/dist/worker.min.js', resolve(dest, 'worker.min.js'));
const core = 'node_modules/tesseract.js-core';
for (const file of await readdir(core))
  if (/^tesseract-core.*\.(wasm|js)$/.test(file))
    await copyFile(resolve(core, file), resolve(dest, file));
const modelUrl =
  'https://raw.githubusercontent.com/naptha/tessdata/gh-pages/4.0.0/eng.traineddata.gz';
const response = await fetch(modelUrl);
if (!response.ok) throw new Error(`OCR model download failed (${response.status})`);
const bytes = new Uint8Array(await response.arrayBuffer());
await writeFile(resolve(dest, 'eng.traineddata.gz'), bytes);
await writeFile(
  resolve(dest, 'NOTICE.txt'),
  'Tesseract.js and Tesseract.js-core: Apache-2.0. English tessdata from ' +
    modelUrl +
    '; see upstream licenses. Assets are downloaded during setup, never from user documents.\n',
);
console.log('Local English OCR assets prepared.');
