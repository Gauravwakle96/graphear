import { z } from 'zod';

const id = z
  .string()
  .min(1)
  .max(100)
  .regex(/^[a-zA-Z0-9_-]+$/);
export const reviewSchema = z.enum(['confirmed', 'detected', 'inferred']);
const boxSchema = z
  .object({
    x: z.number().finite().min(0),
    y: z.number().finite().min(0),
    width: z.number().finite().positive().max(4096),
    height: z.number().finite().positive().max(4096),
  })
  .strict();
export const nodeSchema = z
  .object({
    id,
    label: z.string().trim().min(1).max(250),
    type: z.enum(['start', 'process', 'decision', 'end']),
    x: z.number().finite().min(0),
    y: z.number().finite().min(0),
    width: z.number().finite().min(40).max(1000),
    height: z.number().finite().min(30).max(500),
    review: reviewSchema,
    source: boxSchema.optional(),
  })
  .strict();
export const edgeSchema = z
  .object({
    id,
    source: id,
    target: id,
    label: z.string().trim().max(100).default(''),
    review: reviewSchema,
  })
  .strict();
export const graphSchema = z
  .object({
    schemaVersion: z.literal(1),
    id,
    title: z.string().trim().min(1).max(160),
    description: z.string().max(800).default(''),
    width: z.number().finite().min(200).max(4096),
    height: z.number().finite().min(200).max(4096),
    nodes: z.array(nodeSchema).min(1).max(100),
    edges: z.array(edgeSchema).max(250),
    source: z
      .object({
        name: z.string().max(200),
        kind: z.enum(['sample', 'svg', 'png', 'jpeg', 'json', 'created']),
      })
      .strict()
      .optional(),
  })
  .strict()
  .superRefine((graph, ctx) => {
    const nodeIds = new Set<string>();
    const edgeIds = new Set<string>();
    for (const node of graph.nodes) {
      if (nodeIds.has(node.id))
        ctx.addIssue({ code: 'custom', message: `Duplicate node ID: ${node.id}` });
      nodeIds.add(node.id);
      if (node.x + node.width > graph.width + 1 || node.y + node.height > graph.height + 1)
        ctx.addIssue({ code: 'custom', message: `Node ${node.id} is outside graph bounds` });
      if (
        node.source &&
        (node.source.x + node.source.width > 4096 || node.source.y + node.source.height > 4096)
      )
        ctx.addIssue({
          code: 'custom',
          message: `Source region for ${node.id} is outside supported bounds`,
        });
    }
    for (const edge of graph.edges) {
      if (edgeIds.has(edge.id))
        ctx.addIssue({ code: 'custom', message: `Duplicate edge ID: ${edge.id}` });
      edgeIds.add(edge.id);
      if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target))
        ctx.addIssue({
          code: 'custom',
          message: `Missing node reference on connection ${edge.id}`,
        });
    }
  });
export type Graph = z.infer<typeof graphSchema>;
export type GraphNode = Graph['nodes'][number];
export type GraphEdge = Graph['edges'][number];
export function parseGraph(input: unknown): Graph {
  const result = graphSchema.safeParse(input);
  if (!result.success)
    throw new Error(
      result.error.issues
        .map((i) => i.message)
        .slice(0, 4)
        .join('. '),
    );
  return result.data;
}
export function outgoing(graph: Graph, nodeId: string) {
  return graph.edges.filter((edge) => edge.source === nodeId);
}
export function incoming(graph: Graph, nodeId: string) {
  return graph.edges.filter((edge) => edge.target === nodeId);
}
export function startNode(graph: Graph) {
  return (
    graph.nodes.find((n) => n.type === 'start') ??
    graph.nodes.find((n) => incoming(graph, n.id).length === 0) ??
    graph.nodes[0]
  );
}
export function reachable(graph: Graph, startId: string): Set<string> {
  const visited = new Set<string>();
  if (!graph.nodes.some((n) => n.id === startId)) return visited;
  const queue = [startId];
  for (let i = 0; i < queue.length; i++) {
    const id = queue[i];
    if (visited.has(id)) continue;
    visited.add(id);
    for (const edge of outgoing(graph, id)) if (!visited.has(edge.target)) queue.push(edge.target);
  }
  return visited;
}
export function shortestPath(graph: Graph, startId: string, targetId: string): string[] {
  if (!graph.nodes.some((n) => n.id === startId) || !graph.nodes.some((n) => n.id === targetId))
    return [];
  const parents = new Map<string, string | null>([[startId, null]]);
  const queue = [startId];
  for (let i = 0; i < queue.length; i++) {
    const id = queue[i];
    if (id === targetId) {
      const path: string[] = [];
      let p: string | null = targetId;
      while (p !== null) {
        path.unshift(p);
        p = parents.get(p) ?? null;
      }
      return path;
    }
    for (const edge of outgoing(graph, id))
      if (!parents.has(edge.target)) {
        parents.set(edge.target, id);
        queue.push(edge.target);
      }
  }
  return [];
}
export function analyzeGraph(graph: Graph) {
  const start = startNode(graph);
  const accessible = reachable(graph, start.id);
  const cycles: string[][] = [];
  const done = new Set<string>();
  const stack: string[] = [];
  const active = new Set<string>();
  const signatures = new Set<string>();
  const visit = (id: string) => {
    if (done.has(id)) return;
    if (active.has(id)) {
      const cycle = stack.slice(stack.indexOf(id));
      const signature = [...cycle].sort().join('|');
      if (!signatures.has(signature)) {
        signatures.add(signature);
        cycles.push(cycle);
      }
      return;
    }
    active.add(id);
    stack.push(id);
    for (const edge of outgoing(graph, id)) visit(edge.target);
    stack.pop();
    active.delete(id);
    done.add(id);
  };
  for (const node of graph.nodes) visit(node.id);
  return {
    startId: start.id,
    reachable: [...accessible],
    unreachable: graph.nodes.filter((n) => !accessible.has(n.id)).map((n) => n.id),
    outcomes: graph.nodes.filter((n) => n.type === 'end').map((n) => n.id),
    reachableOutcomes: graph.nodes
      .filter((n) => n.type === 'end' && accessible.has(n.id))
      .map((n) => n.id),
    deadEnds: graph.nodes
      .filter((n) => n.type !== 'end' && outgoing(graph, n.id).length === 0)
      .map((n) => n.id),
    cycles,
    pendingReview:
      graph.nodes.filter((n) => n.review !== 'confirmed').length +
      graph.edges.filter((e) => e.review !== 'confirmed').length,
  };
}
export function describeNode(graph: Graph, nodeId: string) {
  const node = graph.nodes.find((n) => n.id === nodeId);
  if (!node) return 'No step selected.';
  const edges = outgoing(graph, nodeId);
  const branches = edges
    .map(
      (edge) =>
        `${edge.label ? `${edge.label}: ` : ''}${graph.nodes.find((n) => n.id === edge.target)?.label ?? edge.target}${edge.review !== 'confirmed' ? ' (connection needs review)' : ''}`,
    )
    .join('; ');
  return `${node.label}. ${node.type === 'end' ? 'Outcome' : node.type === 'start' ? 'Starting step' : node.type === 'decision' ? 'Decision' : 'Process step'}. ${edges.length === 0 ? 'No outgoing connections.' : `${edges.length} outgoing connection${edges.length === 1 ? '' : 's'}: ${branches}.`}`;
}
export function diffGraphs(before: Graph, after: Graph) {
  const oldNodes = new Map(before.nodes.map((n) => [n.id, n]));
  const newNodes = new Map(after.nodes.map((n) => [n.id, n]));
  const oldEdges = new Map(before.edges.map((e) => [e.id, e]));
  const newEdges = new Map(after.edges.map((e) => [e.id, e]));
  const changedEdges = after.edges
    .filter((e) => {
      const old = oldEdges.get(e.id);
      return old && (old.source !== e.source || old.target !== e.target || old.label !== e.label);
    })
    .map((e) => ({ before: oldEdges.get(e.id)!, after: e }));
  const fromBefore = reachable(before, startNode(before).id);
  const fromAfter = reachable(after, startNode(after).id);
  return {
    addedNodes: after.nodes.filter((n) => !oldNodes.has(n.id)).map((n) => n.id),
    removedNodes: before.nodes.filter((n) => !newNodes.has(n.id)).map((n) => n.id),
    changedNodes: after.nodes
      .filter((n) => {
        const old = oldNodes.get(n.id);
        return old && (old.label !== n.label || old.type !== n.type);
      })
      .map((n) => n.id),
    addedEdges: after.edges.filter((e) => !oldEdges.has(e.id)),
    removedEdges: before.edges.filter((e) => !newEdges.has(e.id)),
    changedEdges,
    gainedOutcomes: after.nodes
      .filter((n) => n.type === 'end' && fromAfter.has(n.id) && !fromBefore.has(n.id))
      .map((n) => n.id),
    lostOutcomes: before.nodes
      .filter((n) => n.type === 'end' && fromBefore.has(n.id) && !fromAfter.has(n.id))
      .map((n) => n.id),
  };
}
export function graphSummary(graph: Graph) {
  const a = analyzeGraph(graph);
  return `${graph.title}. ${graph.nodes.length} steps, ${graph.edges.length} connections, ${a.outcomes.length} outcomes. ${a.pendingReview ? `${a.pendingReview} items need review.` : 'All items confirmed.'} ${a.unreachable.length ? `${a.unreachable.length} steps cannot be reached from ${startNode(graph).label}.` : ''} ${a.cycles.length ? `${a.cycles.length} loop${a.cycles.length === 1 ? '' : 's'} found.` : ''}`.trim();
}
export function graphText(graph: Graph) {
  return `${graphSummary(graph)}\n\n${graph.nodes.map((n, i) => `${i + 1}. ${describeNode(graph, n.id)}`).join('\n\n')}`;
}
export function createBlankGraph(): Graph {
  return {
    schemaVersion: 1,
    id: crypto.randomUUID(),
    title: 'Untitled diagram',
    description: '',
    width: 820,
    height: 740,
    nodes: [
      {
        id: 'start',
        label: 'Start',
        type: 'start',
        x: 320,
        y: 60,
        width: 180,
        height: 60,
        review: 'confirmed',
      },
    ],
    edges: [],
    source: { name: 'Created in Graphear', kind: 'created' },
  };
}
