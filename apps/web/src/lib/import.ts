import { parseGraph, type Graph, type GraphNode, type GraphEdge } from '@graphear/core';
export type Imported = { graph: Graph; image?: string; notes: string[] };

export async function validateRasterFile(file: File) {
  const ext = file.name.toLowerCase().split('.').at(-1);
  if (!['png', 'jpg', 'jpeg', 'webp'].includes(ext ?? ''))
    throw new Error('Choose a PNG, JPEG or WEBP image.');
  if (file.size > 20 * 1024 * 1024) throw new Error('Images are limited to 20 MB.');
  const bytes = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  const png = [137, 80, 78, 71, 13, 10, 26, 10].every((b, i) => bytes[i] === b);
  const jpeg = bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
  const webp =
    String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' &&
    String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP';
  if (!(
    (ext === 'png' && png) ||
    (['jpg', 'jpeg'].includes(ext ?? '') && jpeg) ||
    (ext === 'webp' && webp)
  ))
    throw new Error('The file contents do not match its image format.');
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    if (image.naturalWidth * image.naturalHeight > 16_000_000)
      throw new Error('Resize this image to fewer than 16 million pixels.');
  } finally {
    URL.revokeObjectURL(url);
  }
}
type Point = { x: number; y: number };
const number = (value: string | null, fallback = 0) => {
  const n = Number.parseFloat(value ?? '');
  return Number.isFinite(n) ? n : fallback;
};
const slug = (value: string, fallback: string) =>
  value.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 80) || fallback;
const safeImage = (text: string) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(text)}`;
export function validateSvg(text: string) {
  const doc = new DOMParser().parseFromString(text, 'image/svg+xml');
  if (doc.querySelector('parsererror') || doc.documentElement.localName !== 'svg')
    throw new Error('This SVG is not valid. Try a PNG or JSON diagram.');
  if (doc.querySelector('script,foreignObject,image,iframe,object,embed'))
    throw new Error(
      'This SVG contains active or embedded content. Export a plain SVG or PNG instead.',
    );
  for (const el of doc.querySelectorAll('*'))
    for (const attr of el.attributes) {
      const name = attr.name.toLowerCase();
      if (
        name.startsWith('on') ||
        ((name === 'href' || name === 'xlink:href') && !attr.value.startsWith('#')) ||
        /url\(\s*['"]?(?!#)/i.test(attr.value) ||
        /@import/i.test(attr.value)
      )
        throw new Error('External references and active content are not allowed in diagram SVGs.');
    }
  if (
    doc.querySelector('style') &&
    /url\(|@import/i.test(doc.querySelector('style')!.textContent ?? '')
  )
    throw new Error('External SVG styles are not supported.');
  return doc;
}
function endpoints(d: string): [Point, Point] | null {
  const tokens = d.match(/[a-zA-Z]|[-+]?(?:\d*\.\d+|\d+\.?\d*)(?:e[-+]?\d+)?/gi);
  if (!tokens) return null;
  let i = 0,
    x = 0,
    y = 0,
    first: Point | null = null,
    command = '';
  const counts: Record<string, number> = {
    M: 2,
    L: 2,
    H: 1,
    V: 1,
    C: 6,
    S: 4,
    Q: 4,
    T: 2,
    A: 7,
    Z: 0,
  };
  while (i < tokens.length) {
    if (/^[a-zA-Z]$/.test(tokens[i])) command = tokens[i++];
    const upper = command.toUpperCase();
    const count = counts[upper];
    if (count === undefined) return null;
    if (count === 0) {
      command = '';
      continue;
    }
    if (!command || i + count > tokens.length) return null;
    const values = tokens.slice(i, i + count).map(Number);
    if (values.some((v) => !Number.isFinite(v))) return null;
    i += count;
    const relative = command !== upper;
    if (upper === 'H') x = values[0] + (relative ? x : 0);
    else if (upper === 'V') y = values[0] + (relative ? y : 0);
    else {
      x = values[count - 2] + (relative ? x : 0);
      y = values[count - 1] + (relative ? y : 0);
    }
    if (!first) first = { x, y };
    if (upper === 'M') command = relative ? 'l' : 'L';
  }
  return first ? [first, { x, y }] : null;
}
function distanceToBox(point: Point, node: GraphNode) {
  const dx = Math.max(node.x - point.x, 0, point.x - node.x - node.width),
    dy = Math.max(node.y - point.y, 0, point.y - node.y - node.height);
  return (
    Math.hypot(dx, dy) +
    Math.hypot(point.x - node.x - node.width / 2, point.y - node.y - node.height / 2) * 0.025
  );
}
export function importSvg(text: string, name: string): Imported {
  const doc = validateSvg(text);
  if (doc.querySelector('[transform]')) throw new Error('Complex SVG layout');
  const root = doc.documentElement;
  const view = (root.getAttribute('viewBox') ?? '').trim().split(/[ ,]+/).map(Number);
  const sourceWidth = view.length === 4 ? view[2] : number(root.getAttribute('width'), 820),
    sourceHeight = view.length === 4 ? view[3] : number(root.getAttribute('height'), 740);
  if (sourceWidth <= 0 || sourceHeight <= 0 || sourceWidth > 16000 || sourceHeight > 16000)
    throw new Error('Invalid SVG dimensions.');
  const scale = Math.min(1, 2048 / sourceWidth, 2048 / sourceHeight);
  const width = Math.max(200, Math.ceil(sourceWidth * scale)),
    height = Math.max(200, Math.ceil(sourceHeight * scale));
  const offsetX = view.length === 4 ? view[0] : 0,
    offsetY = view.length === 4 ? view[1] : 0;
  const point = (p: Point) => ({ x: (p.x - offsetX) * scale, y: (p.y - offsetY) * scale });
  const nodes: GraphNode[] = [];
  const shapes = [...doc.querySelectorAll('rect,ellipse,circle,polygon')].filter(
    (el) => !el.closest('defs,marker'),
  );
  const textEls = [...doc.querySelectorAll('text')].filter((el) => !el.closest('defs,marker'));
  for (const [index, el] of shapes.entries()) {
    let x = 0,
      y = 0,
      w = 0,
      h = 0;
    if (el.localName === 'rect') {
      x = number(el.getAttribute('x'));
      y = number(el.getAttribute('y'));
      w = number(el.getAttribute('width'));
      h = number(el.getAttribute('height'));
    } else if (el.localName === 'polygon') {
      const coords = (el.getAttribute('points') ?? '').match(/[-+]?[\d.]+/g)?.map(Number) ?? [];
      const xs = coords.filter((_, i) => i % 2 === 0),
        ys = coords.filter((_, i) => i % 2 === 1);
      if (!xs.length || !ys.length) continue;
      x = Math.min(...xs);
      y = Math.min(...ys);
      w = Math.max(...xs) - x;
      h = Math.max(...ys) - y;
    } else {
      const rx = number(el.getAttribute(el.localName === 'circle' ? 'r' : 'rx')),
        ry = number(el.getAttribute(el.localName === 'circle' ? 'r' : 'ry'));
      x = number(el.getAttribute('cx')) - rx;
      y = number(el.getAttribute('cy')) - ry;
      w = rx * 2;
      h = ry * 2;
    }
    if (w < 25 || h < 20 || w * h > sourceWidth * sourceHeight * 0.75) continue;
    const matching = textEls.filter((t) => {
      const tx = number(t.getAttribute('x')),
        ty = number(t.getAttribute('y'));
      return tx >= x - 2 && tx <= x + w + 2 && ty >= y - 2 && ty <= y + h + 2;
    });
    const label = matching
      .map((t) => t.textContent?.trim())
      .filter(Boolean)
      .join(' ')
      .slice(0, 250);
    if (!label) continue;
    const pos = point({ x, y });
    const nw = Math.max(40, w * scale),
      nh = Math.max(30, h * scale);
    const nodeId = slug(el.getAttribute('data-node-id') ?? el.id, `node-${index + 1}`);
    const uniqueId = nodes.some((n) => n.id === nodeId) ? `${nodeId}-${index}` : nodeId;
    const supplied = el.getAttribute('data-node-type');
    const type =
      supplied && ['start', 'process', 'decision', 'end'].includes(supplied)
        ? (supplied as GraphNode['type'])
        : el.localName === 'polygon'
          ? 'decision'
          : /^(start|begin)/i.test(label)
            ? 'start'
            : /approved|declined|not eligible|finish|^end$|reject/i.test(label)
              ? 'end'
              : 'process';
    nodes.push({
      id: uniqueId,
      label,
      type,
      x: Math.max(0, Math.min(width - nw, pos.x)),
      y: Math.max(0, Math.min(height - nh, pos.y)),
      width: nw,
      height: nh,
      review: 'detected',
      source: { x: Math.max(0, pos.x), y: Math.max(0, pos.y), width: w * scale, height: h * scale },
    });
  }
  if (!nodes.length) throw new Error('No simple labelled SVG shapes');
  const edges: GraphEdge[] = [];
  for (const [index, el] of [...doc.querySelectorAll('line,polyline,path')]
    .filter((e) => !e.closest('defs,marker'))
    .entries()) {
    let pair: [Point, Point] | null = null;
    if (el.localName === 'line')
      pair = [
        { x: number(el.getAttribute('x1')), y: number(el.getAttribute('y1')) },
        { x: number(el.getAttribute('x2')), y: number(el.getAttribute('y2')) },
      ];
    else if (el.localName === 'polyline') {
      const values = (el.getAttribute('points') ?? '').match(/[-+]?[\d.]+/g)?.map(Number) ?? [];
      if (values.length >= 4)
        pair = [
          { x: values[0], y: values[1] },
          { x: values.at(-2)!, y: values.at(-1)! },
        ];
    } else pair = endpoints(el.getAttribute('d') ?? '');
    if (!pair) continue;
    let [a, b] = pair.map(point);
    if (el.hasAttribute('marker-start') && !el.hasAttribute('marker-end')) [a, b] = [b, a];
    const source = el.getAttribute('data-source')
      ? nodes.find((n) => n.id === el.getAttribute('data-source'))
      : nodes.toSorted((n, m) => distanceToBox(a, n) - distanceToBox(a, m))[0];
    const target = el.getAttribute('data-target')
      ? nodes.find((n) => n.id === el.getAttribute('data-target'))
      : nodes.toSorted((n, m) => distanceToBox(b, n) - distanceToBox(b, m))[0];
    if (
      !source ||
      !target ||
      source.id === target.id ||
      distanceToBox(a, source) > 120 ||
      distanceToBox(b, target) > 120
    )
      continue;
    const midpoint = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    const branch = textEls.find((t) => {
      const p = point({ x: number(t.getAttribute('x')), y: number(t.getAttribute('y')) });
      return (
        /^(yes|no|true|false|complete)$/i.test(t.textContent?.trim() ?? '') &&
        Math.hypot(p.x - midpoint.x, p.y - midpoint.y) < 85
      );
    });
    const edgeId = slug(el.id, `edge-${index + 1}`);
    edges.push({
      id: edges.some((e) => e.id === edgeId) ? `${edgeId}-${index}` : edgeId,
      source: source.id,
      target: target.id,
      label: el.getAttribute('data-label') ?? branch?.textContent?.trim() ?? '',
      review: 'inferred',
    });
  }
  return {
    graph: parseGraph({
      schemaVersion: 1,
      id: crypto.randomUUID(),
      title: name.replace(/\.[^.]+$/, ''),
      description: 'Imported SVG. Check every label and connection before confirming.',
      width,
      height,
      nodes,
      edges,
      source: { name, kind: 'svg' },
    }),
    image: safeImage(text),
    notes: [
      'SVG labels and geometry were extracted locally. Connections and step types require review.',
    ],
  };
}
async function raster(source: string) {
  const image = new Image();
  image.src = source;
  await image.decode();
  if (image.naturalWidth * image.naturalHeight > 16_000_000)
    throw new Error(
      'This image is too large to process safely. Resize it to fewer than 16 million pixels.',
    );
  const scale = Math.min(
    2048 / image.naturalWidth,
    2048 / image.naturalHeight,
    Math.max(1, 800 / image.naturalWidth),
  );
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(200, Math.ceil(image.naturalWidth * scale));
  canvas.height = Math.max(200, Math.ceil(image.naturalHeight * scale));
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Image processing is unavailable in this browser.');
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(image, 0, 0, image.naturalWidth * scale, image.naturalHeight * scale);
  return canvas;
}
async function ocr(
  source: string,
  name: string,
  kind: 'png' | 'jpeg' | 'svg',
  progress: (text: string, value: number) => void,
  signal: AbortSignal,
): Promise<Imported> {
  const canvas = await raster(source);
  signal.throwIfAborted();
  const { createWorker, PSM } = await import('tesseract.js');
  const worker = await createWorker('eng', 1, {
    workerPath: '/ocr/worker.min.js',
    corePath: '/ocr',
    langPath: '/ocr',
    workerBlobURL: false,
    logger: (m) => progress(m.status, Math.round((m.progress ?? 0) * 100)),
  });
  const cancel = () => {
    void worker.terminate();
  };
  signal.addEventListener('abort', cancel, { once: true });
  try {
    signal.throwIfAborted();
    await worker.setParameters({ tessedit_pageseg_mode: PSM.SPARSE_TEXT });
    const result = await worker.recognize(canvas, {}, { blocks: true, text: true });
    signal.throwIfAborted();
    const lines = result.data.blocks?.flatMap((b) => b.paragraphs.flatMap((p) => p.lines)) ?? [];
    const meaningful = lines.filter(
      (l) =>
        /[a-zA-Z0-9]/.test(l.text) &&
        l.text.trim().length > 1 &&
        !/^(yes|no|true|false)$/i.test(l.text.trim()),
    );
    if (!meaningful.length)
      throw new Error(
        'No readable English labels were found. Try a sharper image, SVG, or create the diagram manually.',
      );
    const width = canvas.width,
      height = canvas.height;
    const nodes: GraphNode[] = meaningful.slice(0, 60).map((line, index) => {
      const box = line.bbox;
      const w = Math.min(width, Math.max(140, box.x1 - box.x0 + 42)),
        h = Math.min(height, Math.max(54, box.y1 - box.y0 + 30));
      return {
        id: `step-${index + 1}`,
        label: line.text.trim().slice(0, 250),
        type: /\?|^if\b|check|eligible/i.test(line.text)
          ? 'decision'
          : /^(start|begin)/i.test(line.text)
            ? 'start'
            : /^(end|finish)|approved|rejected|not eligible/i.test(line.text)
              ? 'end'
              : 'process',
        x: Math.max(0, Math.min(width - w, box.x0 - 21)),
        y: Math.max(0, Math.min(height - h, box.y0 - 15)),
        width: w,
        height: h,
        review: 'detected',
        source: {
          x: box.x0,
          y: box.y0,
          width: Math.max(1, box.x1 - box.x0),
          height: Math.max(1, box.y1 - box.y0),
        },
      };
    });
    return {
      graph: parseGraph({
        schemaVersion: 1,
        id: crypto.randomUUID(),
        title: name.replace(/\.[^.]+$/, ''),
        description: 'Local text extraction only. No diagram structure or arrows were recognized.',
        width,
        height,
        nodes,
        edges: [],
        source: { name, kind },
      }),
      image: canvas.toDataURL('image/png'),
      notes: [
        'Local OCR extracted text only; no arrows or relationships were recognized. Labels may be incorrect. Reconstruct with AI or manually define the structure in Edit.',
      ],
    };
  } finally {
    signal.removeEventListener('abort', cancel);
    await worker.terminate().catch(() => undefined);
  }
}
export async function importFile(
  file: File,
  progress: (text: string, value: number) => void,
  signal: AbortSignal,
): Promise<Imported> {
  if (file.size > 5 * 1024 * 1024)
    throw new Error('Maximum file size is 5 MB. Resize the image or export a smaller diagram.');
  const ext = file.name.toLowerCase().split('.').at(-1);
  if (!['json', 'svg', 'png', 'jpg', 'jpeg'].includes(ext ?? ''))
    throw new Error('Choose a PNG, JPEG, SVG or Graphear JSON file.');
  progress('Reading diagram', 5);
  signal.throwIfAborted();
  if (ext === 'json') {
    if (file.size > 1024 * 1024) throw new Error('JSON diagrams must be smaller than 1 MB.');
    const graph = parseGraph(JSON.parse(await file.text()));
    return {
      graph: { ...graph, source: { name: file.name, kind: 'json' } },
      notes: [
        'Graph structure was read from JSON. Review the author-supplied labels and connections.',
      ],
    };
  }
  if (ext === 'svg') {
    const text = await file.text();
    validateSvg(text);
    try {
      return importSvg(text, file.name);
    } catch (error) {
      if (
        error instanceof Error &&
        !/Complex SVG|No simple labelled SVG shapes/.test(error.message)
      )
        throw error;
      return ocr(safeImage(text), file.name, 'svg', progress, signal);
    }
  }
  const bytes = new Uint8Array(await file.slice(0, 8).arrayBuffer());
  const png = bytes[0] === 137 && bytes[1] === 80 && bytes[2] === 78 && bytes[3] === 71,
    jpeg = bytes[0] === 255 && bytes[1] === 216;
  if (!png && !jpeg) throw new Error('The file contents do not match a supported image.');
  const url = URL.createObjectURL(file);
  try {
    return await ocr(url, file.name, png ? 'png' : 'jpeg', progress, signal);
  } finally {
    URL.revokeObjectURL(url);
  }
}
