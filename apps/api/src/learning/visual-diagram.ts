import { z } from 'zod';
import { categorySchema, studyEdgeSchema, validateDiagram, type Source } from '@graphear/core';
export function sourceInventory(sources: Source[]) {
  const labels = new Map<string, string>();
  sources
    .flatMap((s) => [
      ...(s.visualLabels ?? []),
      ...(s.conceptLabels ?? []),
      ...(s.conceptRelations ?? []).flatMap((r) => [r.source, r.target]),
      ...(s.conceptOrders ?? []).flatMap((order) => order.components),
    ])
    .forEach((label) => {
      if (!labels.has(label.toLowerCase())) labels.set(label.toLowerCase(), label);
    });
  if (labels.size > 80)
    throw new Error('Too many essential concepts for one diagram. Split this source into topics.');
  return [...labels.values()];
}
export function inventoryDiagramSchema(sources: Source[], mindmap: boolean) {
  const labels = sourceInventory(sources);
  if (!labels.length) throw new Error('Source has no diagram component inventory.');
  const label = z.enum((mindmap ? [...labels, '__topic__'] : labels) as [string, ...string[]]);
  const shared = {
    title: z.string().min(1).max(180),
    description: z.string().min(1).max(4000),
    details: z
      .array(z.object({ label, points: z.array(z.string().max(150)).max(8) }).strict())
      .max(80),
    warnings: z.array(z.string().max(500)).max(15),
  };
  return mindmap
    ? z
        .object({
          ...shared,
          parents: z
            .array(z.object({ label, parent: label.nullable() }).strict())
            .length(labels.length + 1),
        })
        .strict()
    : z
        .object({
          ...shared,
          kind: categorySchema,
          connections: z
            .array(
              z
                .object({
                  source: label,
                  target: label,
                  label: z.string().max(200),
                  relation: studyEdgeSchema.shape.relation,
                  direction: studyEdgeSchema.shape.direction,
                })
                .strict(),
            )
            .max(150),
        })
        .strict();
}
export function expandInventoryDiagram(value: unknown, sources: Source[], mindmap: boolean) {
  const result = inventoryDiagramSchema(sources, mindmap).parse(value);
  const labels = sourceInventory(sources);
  const ids = new Map(labels.map((label, i) => [label.toLowerCase(), 'component' + i]));
  if (mindmap) ids.set('__topic__', 'topic-root');
  const id = (label: string) => ids.get(label.toLowerCase())!;
  const details = new Map(result.details.map((d) => [d.label.toLowerCase(), d.points]));
  const nodes = labels.map((label) => ({
    id: id(label),
    label,
    details: details.get(label.toLowerCase()) ?? [],
  }));
  if ('parents' in result) {
    if (new Set(result.parents.map((p) => p.label)).size !== labels.length + 1)
      throw new Error(
        'Mind map must declare a parent for each inventoried component exactly once.',
      );
    if (result.parents.find((p) => p.label === '__topic__')?.parent !== null)
      throw new Error('The central mind-map topic must be its root.');
    const parents = new Map(
      result.parents.map((p) => [id(p.label), p.parent === null ? null : id(p.parent)]),
    );
    return expandVisualMindMap(
      {
        title: result.title,
        description: result.description,
        warnings: result.warnings,
        nodes: [...nodes, { id: 'topic-root', label: result.title, details: [] }].map((n) => ({
          ...n,
          parent: parents.get(n.id),
        })),
      },
      sources,
    );
  }
  const edges = [
    ...sources.flatMap((s) => s.conceptRelations ?? []).map((e) => ({ ...e, label: '' })),
    ...sources
      .flatMap((s) => s.conceptOrders ?? [])
      .flatMap((order) =>
        order.components.slice(1).map((target, i) => ({
          source: order.components[i],
          target,
          label: order.label,
          relation: order.relation,
          direction: order.direction,
        })),
      ),
    ...result.connections,
  ];
  const unique = new Map(
    edges.map((e) => {
      const source = id(e.source),
        target = id(e.target);
      if (!source || !target) throw new Error('Inventoried relationship has an unknown component.');
      return [JSON.stringify([source, target, e.relation, e.direction]), { ...e, source, target }];
    }),
  );
  return expandVisualDiagram(
    {
      title: result.title,
      description: result.description,
      kind: result.kind,
      nodes,
      edges: [...unique.values()],
      warnings: result.warnings,
    },
    sources,
  );
}
export function visualMindMapSchema(labelCount: number) {
  return z
    .object({
      title: z.string().min(1).max(180),
      description: z.string().min(1).max(4000),
      nodes: z
        .array(
          z
            .object({
              id: z.string().min(1).max(80),
              label: z.string().min(1).max(250),
              parent: z.string().min(1).max(80).nullable(),
              details: z.array(z.string().max(150)).max(20),
            })
            .strict(),
        )
        .min(Math.min(40, Math.max(1, labelCount)))
        .max(80),
      warnings: z.array(z.string().max(500)).max(15),
    })
    .strict();
}
export function expandVisualMindMap(value: unknown, sources: Source[]) {
  const v = visualMindMapSchema(1).parse(value);
  const roots = v.nodes.filter((n) => n.parent === null);
  if (roots.length !== 1)
    throw new Error('A mind map must have one root and a parent for every other component.');
  const nodes = new Map(v.nodes.map((n) => [n.id, n]));
  for (const node of v.nodes) {
    const seen = new Set<string>();
    let cursor = node;
    while (cursor.parent !== null) {
      if (seen.has(cursor.id)) throw new Error('Mind map hierarchy contains a cycle.');
      seen.add(cursor.id);
      const parent = nodes.get(cursor.parent);
      if (!parent) throw new Error('Mind map component references a missing parent.');
      cursor = parent;
    }
  }
  return expandVisualDiagram(
    {
      title: v.title,
      kind: 'mindmap',
      description: v.description,
      nodes: v.nodes.map(({ parent: _parent, ...n }) => n),
      edges: v.nodes
        .filter((n) => n.parent !== null)
        .map((n) => ({
          source: n.parent,
          target: n.id,
          label: '',
          relation: 'contains',
          direction: 'forward',
        })),
      warnings: v.warnings,
    },
    sources,
  );
}

// Keep focused visual output small enough for complete figures on lightweight
// models. The full representation is restored and validated before rendering.
export function visualDiagramSchema(labelCount: number) {
  return z
    .object({
      title: z.string().min(1).max(180),
      kind: categorySchema,
      description: z.string().min(1).max(4000),
      nodes: z
        .array(
          z
            .object({
              id: z.string().min(1).max(80),
              label: z.string().min(1).max(250),
              details: z.array(z.string().max(150)).max(20),
            })
            .strict(),
        )
        .min(Math.min(40, Math.max(1, labelCount)))
        .max(80),
      edges: z
        .array(
          z
            .object({
              source: z.string().min(1).max(80),
              target: z.string().min(1).max(80),
              label: z.string().max(200),
              relation: studyEdgeSchema.shape.relation,
              direction: studyEdgeSchema.shape.direction,
            })
            .strict(),
        )
        .max(150),
      warnings: z.array(z.string().max(500)).max(15),
    })
    .strict();
}
export function expandVisualDiagram(value: unknown, sources: Source[]) {
  const v = visualDiagramSchema(1).parse(value);
  const evidence = sources.map((s) => s.id);
  const relevant = (label: string) => {
    const text = label.toLowerCase();
    const matching = sources
      .filter((s) =>
        [...(s.conceptLabels ?? []), ...(s.visualLabels ?? [])].some((name) =>
          text.includes(name.toLowerCase()),
        ),
      )
      .map((s) => s.id);
    return matching.length ? matching : evidence.slice(0, 20);
  };
  return validateDiagram(
    {
      id: 'reconstruction',
      title: v.title,
      kind: v.kind,
      description: v.description,
      nodes: v.nodes.map((n) => ({
        id: n.id,
        label: n.label,
        role: ['mindmap', 'concept'].includes(v.kind) ? 'concept' : 'component',
        shape: 'rectangle',
        symbol: 'none',
        position: null,
        attributes: [],
        methods: n.details,
        ports: [],
        evidence: relevant(n.label),
      })),
      edges: v.edges.map((e, i) => ({
        ...e,
        id: 'edge' + i,
        sourcePort: null,
        targetPort: null,
        evidence: [
          ...new Set([
            ...relevant(v.nodes.find((n) => n.id === e.source)?.label ?? ''),
            ...relevant(v.nodes.find((n) => n.id === e.target)?.label ?? ''),
          ]),
        ].slice(0, 20),
      })),
      warnings: v.warnings,
      reviewed: false,
    },
    new Set(sources.map((s) => s.id)),
  );
}
