import type { Graph } from '@graphear/core';
const escape = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[c]!,
  );
export function graphSvg(graph: Graph) {
  const nodes = new Map(graph.nodes.map((n) => [n.id, n]));
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${graph.width}" height="${graph.height}" viewBox="0 0 ${graph.width} ${graph.height}"><title>${escape(graph.title)}</title><defs><marker id="arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0 0 L8 4 L0 8 Z" fill="#637568"/></marker></defs><rect width="${graph.width}" height="${graph.height}" fill="#fbfcfa"/>${graph.edges
    .map((edge) => {
      const a = nodes.get(edge.source)!,
        b = nodes.get(edge.target)!;
      const sameColumn = Math.abs(a.x + a.width / 2 - b.x - b.width / 2) < 70;
      const x1 = sameColumn ? a.x + a.width / 2 : a.x,
        y1 = sameColumn ? a.y + a.height : a.y + a.height / 2,
        x2 = sameColumn ? b.x + b.width / 2 : b.x + b.width,
        y2 = sameColumn ? b.y : b.y + b.height / 2;
      const mid = (y1 + y2) / 2;
      return `<path id="${escape(edge.id)}" data-source="${escape(edge.source)}" data-target="${escape(edge.target)}" data-label="${escape(edge.label)}" d="M${x1} ${y1} C${x1} ${mid} ${x2} ${mid} ${x2} ${y2}" fill="none" stroke="#637568" stroke-width="2" marker-end="url(#arrow)"/>${edge.label ? `<text x="${(x1 + x2) / 2 + 20}" y="${(y1 + y2) / 2}" font-family="sans-serif" font-size="14" fill="#334b3b">${escape(edge.label)}</text>` : ''}`;
    })
    .join('')}${graph.nodes
    .map((node) => {
      const attrs = `id="${escape(node.id)}" data-node-id="${escape(node.id)}" data-node-type="${node.type}"`;
      const fill =
        node.type === 'decision' ? '#fcf0d4' : node.type === 'end' ? '#d9edda' : '#edf3e9';
      const cx = node.x + node.width / 2,
        cy = node.y + node.height / 2;
      const shape =
        node.type === 'decision'
          ? `<polygon ${attrs} points="${cx},${node.y} ${node.x + node.width},${cy} ${cx},${node.y + node.height} ${node.x},${cy}" fill="${fill}" stroke="#95ad97"/>`
          : `<rect ${attrs} x="${node.x}" y="${node.y}" width="${node.width}" height="${node.height}" rx="${node.type === 'start' || node.type === 'end' ? 30 : 10}" fill="${fill}" stroke="#95ad97"/>`;
      return `${shape}<text x="${cx}" y="${cy + 5}" text-anchor="middle" font-family="sans-serif" font-size="14" fill="#203b32">${escape(node.label)}</text>`;
    })
    .join('')}</svg>`;
}
