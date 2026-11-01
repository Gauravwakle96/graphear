import { PDFDocument, rgb } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import {
  Document,
  Packer,
  Paragraph,
  HeadingLevel,
  TextRun,
  Table,
  TableRow,
  TableCell,
} from 'docx';
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { zipSync, strToU8 } from 'fflate';
import sharp from 'sharp';
import {
  studyMarkdown,
  studySvg,
  studyMermaid,
  type StudyAnalysis,
  type Source,
} from '@graphear/core';
const require = createRequire(import.meta.url);
export async function notesPdf(
  a: StudyAnalysis,
  sources: Source[],
  format: 'detailed' | 'short' | 'exam',
  cards = false,
) {
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const fonts = await Promise.all(
    ['latin', 'latin-ext', 'greek', 'cyrillic'].map(async (name) =>
      pdf.embedFont(
        await readFile(
          require.resolve(`@fontsource/noto-sans/files/noto-sans-${name}-400-normal.woff`),
        ),
        { subset: true },
      ),
    ),
  );
  const glyphs = fonts.map((f) => new Set(f.getCharacterSet()));
  const fontFor = (char: string) => {
    const i = glyphs.findIndex((set) => set.has(char.codePointAt(0)!));
    if (i < 0)
      throw new Error(
        `PDF font cannot represent U+${char.codePointAt(0)!.toString(16)}. Use DOCX or Markdown to preserve this text.`,
      );
    return fonts[i];
  };
  let page = pdf.addPage([595, 842]),
    y = 790;
  const line = (text: string, size = 11) => {
    if (y < 60) {
      page = pdf.addPage([595, 842]);
      y = 790;
    }
    let x = 44;
    for (const char of text) {
      const font = fontFor(char);
      page.drawText(char, { x, y, size, font, color: rgb(0.1, 0.2, 0.16) });
      x += font.widthOfTextAtSize(char, size);
    }
    y -= size * 1.65;
  };
  const paragraph = (text: string, size = 11) => {
    let current = '',
      width = 0;
    // Font subsets omit the non-breaking hyphen. Plain hyphen keeps its meaning
    // and remains unbroken because this wrapper splits only at whitespace.
    for (const word of text
      .replace(/\r/g, '')
      .replace(/\u2011/g, '-')
      .split(/\s+/)) {
      let w = 0;
      for (const char of word + ' ') w += fontFor(char).widthOfTextAtSize(char, size);
      if (width + w > 505 && current) {
        line(current, size);
        current = '';
        width = 0;
      }
      if (w > 505) {
        for (const char of word) {
          const cw = fontFor(char).widthOfTextAtSize(char, size);
          if (width + cw > 505) {
            line(current, size);
            current = '';
            width = 0;
          }
          current += char;
          width += cw;
        }
        current += ' ';
      } else {
        current += word + ' ';
        width += w;
      }
    }
    if (current.trim()) line(current.trim(), size);
    y -= 8;
  };
  const refs = new Map(sources.map((s) => [s.id, s.reference]));
  paragraph(a.title, 18);
  if (cards) {
    paragraph('Flashcards', 15);
    for (const c of a.flashcards) {
      paragraph(c.front, 12);
      paragraph(c.back);
      paragraph(c.evidence.map((id) => refs.get(id) ?? id).join('; '), 9);
    }
  } else {
    paragraph(a.summary);
    for (const section of a.notes[format]) {
      paragraph(section.heading, 14);
      for (const item of section.items) {
        paragraph(item.text + (item.origin !== 'source' ? ` [${item.origin}]` : ''));
        if (item.evidence.length)
          paragraph(item.evidence.map((id) => refs.get(id) ?? id).join('; '), 9);
      }
    }
  }
  if (!cards) {
    for (const table of a.tables) {
      paragraph(table.title, 14);
      for (const row of table.rows)
        paragraph(row.map((value, i) => table.columns[i] + ': ' + value).join(' | '));
      paragraph(table.evidence.map((id) => refs.get(id) ?? id).join('; '), 9);
    }
    for (const warning of a.warnings) paragraph('Source warning: ' + warning, 10);
  }
  paragraph(
    'AI-generated study material. Check the original source before relying on technical details.',
    9,
  );
  return Buffer.from(await pdf.save());
}
export async function notesDocx(
  a: StudyAnalysis,
  sources: Source[],
  format: 'detailed' | 'short' | 'exam',
) {
  const refs = new Map(sources.map((s) => [s.id, s.reference]));
  const children: (Paragraph | Table)[] = [
    new Paragraph({ text: a.title, heading: HeadingLevel.TITLE }),
    new Paragraph(a.summary),
  ];
  for (const s of a.notes[format]) {
    children.push(new Paragraph({ text: s.heading, heading: HeadingLevel.HEADING_1 }));
    for (const i of s.items) {
      children.push(
        new Paragraph({
          children: [new TextRun(i.text + (i.origin !== 'source' ? ` [${i.origin}]` : ''))],
          spacing: { after: 150 },
        }),
      );
      if (i.evidence.length)
        children.push(
          new Paragraph({
            children: [
              new TextRun({
                text: i.evidence.map((id) => refs.get(id) ?? id).join('; '),
                italics: true,
                size: 18,
              }),
            ],
          }),
        );
    }
  }
  for (const table of a.tables) {
    children.push(new Paragraph({ text: table.title, heading: HeadingLevel.HEADING_1 }));
    children.push(
      new Table({
        rows: [
          new TableRow({
            children: table.columns.map(
              (c) =>
                new TableCell({
                  children: [new Paragraph({ children: [new TextRun({ text: c, bold: true })] })],
                }),
            ),
          }),
          ...table.rows.map(
            (row) =>
              new TableRow({
                children: row.map((c) => new TableCell({ children: [new Paragraph(c)] })),
              }),
          ),
        ],
      }),
    );
    children.push(new Paragraph(table.evidence.map((id) => refs.get(id) ?? id).join('; ')));
  }
  if (a.warnings.length) {
    children.push(
      new Paragraph({ text: 'Source coverage and uncertainty', heading: HeadingLevel.HEADING_1 }),
    );
    children.push(...a.warnings.map((w) => new Paragraph(w)));
  }
  return Packer.toBuffer(new Document({ sections: [{ children }] }));
}
export async function learningPackage(a: StudyAnalysis, sources: Source[], history: unknown = {}) {
  const parts: Record<string, Uint8Array> = {
    'notes-detailed.md': strToU8(studyMarkdown(a, sources, 'detailed')),
    'notes-short.md': strToU8(studyMarkdown(a, sources, 'short')),
    'notes-exam.md': strToU8(studyMarkdown(a, sources, 'exam')),
    'diagrams.json': strToU8(JSON.stringify(a.diagrams, null, 2)),
    'flashcards.json': strToU8(JSON.stringify(a.flashcards, null, 2)),
    'questions.json': strToU8(JSON.stringify(a.questions, null, 2)),
    'sources.json': strToU8(
      JSON.stringify(
        sources.map(({ asset: _asset, ...s }) => s),
        null,
        2,
      ),
    ),
    'notes.docx': await notesDocx(a, sources, 'detailed'),
    'learning-history.json': strToU8(JSON.stringify(history, null, 2)),
    'README.txt': strToU8(
      'AI-generated learning material. Review source references, diagram connections and uncertainty labels. JSON preserves the full editable diagram structure; SVG/PNG are visual schematics. Original private uploads are downloaded separately from the workspace.',
    ),
  };
  try {
    parts['notes.pdf'] = await notesPdf(a, sources, 'detailed');
    parts['flashcards.pdf'] = await notesPdf(a, sources, 'detailed', true);
  } catch {
    parts['pdf-export-limitation.txt'] = strToU8(
      'PDF generation could not represent every character. DOCX and Markdown preserve the text.',
    );
  }
  for (const d of a.diagrams) {
    const svg = studySvg(d);
    parts[`diagrams/${d.id}.svg`] = strToU8(svg);
    parts[`diagrams/${d.id}.png`] = await sharp(Buffer.from(svg))
      .resize({ width: 2400, height: 2400, fit: 'inside', withoutEnlargement: true })
      .png()
      .toBuffer();
    const mermaid = studyMermaid(d);
    if (mermaid) parts[`diagrams/${d.id}.mmd`] = strToU8(mermaid);
  }
  return Buffer.from(zipSync(parts));
}
