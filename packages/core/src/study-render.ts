import type { StudyDiagram } from './study';
const escape = (s: string) =>
  s
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
export function diagramPositions(d: StudyDiagram): StudyDiagram {
  const copy = structuredClone(d);
  const unpositioned = copy.nodes.every((n) => n.position === null);
  for (let i = 0; i < copy.nodes.length; i++)
    copy.nodes[i].position ??= { x: 80 + (i % 4) * 290, y: 70 + Math.floor(i / 4) * 220 };
  const nodeHeight = (n: StudyDiagram['nodes'][number]) =>
    Math.max(
      160,
      60 +
        [n.label, ...n.attributes.map((a) => a.name + ': ' + a.type), ...n.methods].reduce(
          (lines, text) => lines + Math.ceil(text.length / 24),
          0,
        ) *
          24 +
        (n.symbol === 'none' ? 0 : 80),
    );
  if (unpositioned && copy.kind === 'mindmap' && copy.edges.length === copy.nodes.length - 1) {
    const targets = copy.edges.map((e) => e.target);
    const root = copy.nodes.find((n) => !targets.includes(n.id));
    const children = (id: string) =>
      copy.edges
        .filter((e) => e.source === id)
        .map((e) => copy.nodes.find((n) => n.id === e.target)!);
    const visited = new Set<string>(),
      heights = new Map<string, number>();
    let depth = 0;
    const measure = (n: (typeof copy.nodes)[number], level: number): number => {
      if (visited.has(n.id)) return Number.POSITIVE_INFINITY;
      visited.add(n.id);
      depth = Math.max(depth, level);
      const list = children(n.id);
      const height = Math.max(
        nodeHeight(n),
        list.reduce((sum, child) => sum + measure(child, level + 1), 0) +
          Math.max(0, list.length - 1) * 60,
      );
      heights.set(n.id, height);
      return height;
    };
    const height = root && new Set(targets).size === targets.length ? measure(root, 0) : Infinity;
    if (root && visited.size === copy.nodes.length && height <= 3900 && depth * 310 <= 3900) {
      const place = (n: (typeof copy.nodes)[number], level: number, top: number) => {
        n.position = {
          x: 80 + level * 310,
          y: 70 + top + (heights.get(n.id)! - nodeHeight(n)) / 2,
        };
        for (const child of children(n.id)) {
          place(child, level + 1, top);
          top += heights.get(child.id)! + 60;
        }
      };
      place(root, 0, 0);
    }
  }
  const overlap = copy.nodes.some((a, i) =>
    copy.nodes
      .slice(i + 1)
      .some(
        (b) =>
          a.position!.x < b.position!.x + 250 &&
          a.position!.x + 250 > b.position!.x &&
          a.position!.y < b.position!.y + nodeHeight(b) &&
          a.position!.y + nodeHeight(a) > b.position!.y,
      ),
  );
  if (overlap) {
    const columns = Math.min(10, Math.max(2, Math.ceil(Math.sqrt(copy.nodes.length))));
    let y = 70;
    for (let i = 0; i < copy.nodes.length; i += columns) {
      const row = copy.nodes.slice(i, i + columns);
      row.forEach((n, index) => {
        n.position = { x: 80 + index * 310, y };
      });
      y += Math.max(...row.map(nodeHeight)) + 70;
    }
    const warning =
      'Overlapping layout positions were separated for readability. Original component labels and relationships are retained; compare spatial arrangement with the source.';
    if (!copy.warnings.includes(warning)) copy.warnings = [...copy.warnings.slice(0, 14), warning];
  }
  return copy;
}
export function circuitSymbol(symbol: string, x: number, y: number) {
  const paths: Record<string, string> = {
    resistor: `M ${x - 44} ${y} h 12 l 5 -9 l 10 18 l 10 -18 l 10 18 l 10 -18 l 5 9 h 12`,
    capacitor: `M ${x - 44} ${y} H ${x - 6} M ${x - 6} ${y - 20} v 40 M ${x + 6} ${y - 20} v 40 M ${x + 6} ${y} H ${x + 44}`,
    battery: `M ${x - 44} ${y} H ${x - 8} M ${x - 8} ${y - 22} v 44 M ${x + 8} ${y - 12} v 24 M ${x + 8} ${y} H ${x + 44}`,
    ground: `M ${x} ${y - 24} v 24 M ${x - 22} ${y} h 44 M ${x - 14} ${y + 9} h 28 M ${x - 6} ${y + 18} h 12`,
    switch: `M ${x - 44} ${y} h 20 M ${x - 24} ${y} l 45 -20 M ${x + 24} ${y} h 20`,
    diode: `M ${x - 44} ${y} H ${x - 14} M ${x - 14} ${y - 18} l 28 18 l -28 18 Z M ${x + 14} ${y - 18} v 36 M ${x + 14} ${y} H ${x + 44}`,
    lamp: `M ${x - 44} ${y} H ${x - 22} M ${x + 22} ${y} H ${x + 44} M ${x - 15} ${y - 15} l 30 30 M ${x + 15} ${y - 15} l -30 30`,
  };
  return (
    (symbol === 'lamp' ? `<circle cx="${x}" cy="${y}" r="22" fill="none"/>` : '') +
    (paths[symbol] ? `<path d="${paths[symbol]}" fill="none"/>` : '')
  );
}
export function studySvg(input: StudyDiagram) {
  const d = diagramPositions(input);
  const lines = (n: StudyDiagram['nodes'][number]) =>
    [
      n.label,
      ...n.attributes.map((a) => (a.key ? 'PK ' : '') + a.name + ': ' + a.type),
      ...n.methods,
    ].flatMap((t) => t.match(/.{1,28}/g) ?? ['']);
  const nodeHeight = (n: StudyDiagram['nodes'][number]) => Math.max(130, lines(n).length * 20 + 36);
  const width = Math.max(...d.nodes.map((n) => n.position!.x + 260)) + 60,
    height = Math.max(...d.nodes.map((n) => n.position!.y + nodeHeight(n))) + 100;
  const edges = d.edges
    .map((e) => {
      const a = d.nodes.find((n) => n.id === e.source)!,
        b = d.nodes.find((n) => n.id === e.target)!,
        ax = a.position!.x + 110,
        ay = a.position!.y + nodeHeight(a) / 2,
        bx = b.position!.x + 110,
        by = b.position!.y + nodeHeight(b) / 2;
      const dx = bx - ax,
        dy = by - ay,
        length = Math.max(1, Math.hypot(dx, dy)),
        nx = -dy / length,
        ny = dx / length;
      const parallel =
        d.edges.filter(
          (v) =>
            [e.source, e.target].includes(v.source) &&
            [e.source, e.target].includes(v.target) &&
            v.source !== v.target,
        ).length > 1;
      const lane = parallel ? 32 : 0,
        mx = (ax + bx) / 2 + nx * lane,
        my = (ay + by) / 2 + ny * lane;
      const offset = (n: typeof a, x: number, y: number, tx: number, ty: number) => {
        const vx = tx - x,
          vy = ty - y;
        const factor =
          n.shape === 'ellipse'
            ? 1 / Math.sqrt((vx / 110) ** 2 + (vy / (nodeHeight(n) / 2)) ** 2)
            : Math.min(
                110 / Math.max(1, Math.abs(vx)),
                nodeHeight(n) / 2 / Math.max(1, Math.abs(vy)),
              );
        return { x: x + vx * factor, y: y + vy * factor };
      };
      const from = offset(a, ax, ay, mx, my),
        to = offset(b, bx, by, mx, my);
      const path =
        e.source === e.target
          ? 'M ' +
            (ax + 110) +
            ' ' +
            ay +
            ' C ' +
            (ax + 200) +
            ' ' +
            (ay + 140) +
            ', ' +
            (ax - 130) +
            ' ' +
            (ay + 140) +
            ', ' +
            ax +
            ' ' +
            (ay + nodeHeight(a) / 2)
          : 'M ' + from.x + ' ' + from.y + ' Q ' + mx + ' ' + my + ' ' + to.x + ' ' + to.y;
      return (
        '<g><title>' +
        escape(a.label + ' ' + e.label + ' ' + b.label) +
        '</title><path d="' +
        path +
        '" stroke="#52665a" stroke-width="2" fill="none"' +
        (e.direction !== 'none' ? ' marker-end="url(#arrow)"' : '') +
        (e.direction === 'both' ? ' marker-start="url(#arrow)"' : '') +
        '/>' +
        (e.label
          ? '<text x="' +
            mx +
            '" y="' +
            (my - 9) +
            '" font-size="12" fill="#203b32" paint-order="stroke" stroke="#fff" stroke-width="5">' +
            escape(e.label) +
            '</text>'
          : '') +
        '</g>'
      );
    })
    .join('');
  const nodes = d.nodes
    .map((n) => {
      const { x, y } = n.position!,
        h = nodeHeight(n),
        symbol = d.kind === 'circuit' && n.symbol !== 'none',
        fill = n.role === 'decision' ? '#fff0cf' : '#edf3e8';
      const shape =
        n.shape === 'ellipse'
          ? '<ellipse cx="' +
            (x + 110) +
            '" cy="' +
            (y + h / 2) +
            '" rx="110" ry="' +
            h / 2 +
            '" fill="' +
            fill +
            '" stroke="#52665a"/>'
          : n.shape === 'diamond'
            ? '<polygon points="' +
              (x + 110) +
              ',' +
              y +
              ' ' +
              (x + 220) +
              ',' +
              (y + h / 2) +
              ' ' +
              (x + 110) +
              ',' +
              (y + h) +
              ' ' +
              x +
              ',' +
              (y + h / 2) +
              '" fill="' +
              fill +
              '" stroke="#52665a"/>'
            : '<rect x="' +
              x +
              '" y="' +
              y +
              '" width="220" height="' +
              h +
              '" rx="8" fill="' +
              fill +
              '" stroke="#52665a"/>';
      return (
        '<g><title>' +
        escape(n.label) +
        '</title>' +
        (symbol
          ? '<g stroke="#203b32" stroke-width="2">' +
            circuitSymbol(n.symbol, x + 110, y + 40) +
            '</g>'
          : shape) +
        '<text x="' +
        (x + 110) +
        '" y="' +
        (symbol ? y + 88 : y + 28) +
        '" fill="#203b32" font-size="13">' +
        lines(n)
          .map(
            (t, i) =>
              '<tspan x="' + (x + 110) + '" dy="' + (i ? 20 : 0) + '">' + escape(t) + '</tspan>',
          )
          .join('') +
        '</text></g>'
      );
    })
    .join('');
  return (
    '<svg xmlns="http://www.w3.org/2000/svg" width="' +
    width +
    '" height="' +
    height +
    '" viewBox="0 0 ' +
    width +
    ' ' +
    height +
    '" role="img" aria-labelledby="title desc"><title id="title">' +
    escape(d.title) +
    '</title><desc id="desc">' +
    escape(d.description) +
    '. Draft reconstruction; verify against source.</desc><defs><marker id="arrow" markerWidth="8" markerHeight="8" refX="8" refY="4" orient="auto-start-reverse"><path d="M0 0 L8 4 L0 8 Z" fill="#52665a"/></marker></defs><rect width="100%" height="100%" fill="#fff"/><g font-family="sans-serif" text-anchor="middle">' +
    edges +
    nodes +
    '</g></svg>'
  );
}
const quote = (s: string) =>
  s
    .replaceAll('&', '#amp;')
    .replaceAll('"', '#quot;')
    .replaceAll('<', '#lt;')
    .replaceAll('>', '#gt;')
    .replace(/[\r\n]/g, ' ');
export function studyMermaid(d: StudyDiagram): string | null {
  const ids = new Map(d.nodes.map((n, i) => [n.id, 'n' + i]));
  if (d.kind === 'sequence')
    return (
      'sequenceDiagram\n' +
      d.nodes
        .map((n) => `participant ${ids.get(n.id)} as ${quote(n.label).replaceAll(';', ' ')}`)
        .join('\n') +
      '\n' +
      d.edges
        .map(
          (e) =>
            `${ids.get(e.source)}${e.direction === 'none' ? '--' : e.direction === 'both' ? '<<->>' : '->>'}${ids.get(e.target)}: ${quote(e.label).replaceAll(';', ' ')}`,
        )
        .join('\n')
    );
  if (!['flowchart', 'process', 'block', 'mindmap', 'concept', 'network'].includes(d.kind))
    return null;
  return (
    'flowchart TD\n' +
    d.nodes
      .map(
        (n) =>
          `${ids.get(n.id)}${n.shape === 'diamond' ? '{"' : n.shape === 'ellipse' ? '(["' : '["'}${quote(n.label)}${n.shape === 'diamond' ? '"}' : n.shape === 'ellipse' ? '"])' : '"]'}`,
      )
      .join('\n') +
    '\n' +
    d.edges
      .map(
        (e) =>
          `${ids.get(e.source)} ${e.direction === 'none' ? '---' : e.direction === 'both' ? '<-->' : '-->'}${e.label ? '|"' + quote(e.label) + '"|' : ''} ${ids.get(e.target)}`,
      )
      .join('\n')
  );
}
