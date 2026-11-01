import { describe, it, expect } from 'vitest';
import {
  parseGraph,
  reachable,
  analyzeGraph,
  diffGraphs,
  describeNode,
  shortestPath,
} from './graph';
import { scholarshipGraph } from './samples';

describe('validated graph boundary', () => {
  it('accepts the authored demo', () =>
    expect(parseGraph(scholarshipGraph).nodes.length).toBeGreaterThan(3));
  it('rejects dangling edge references', () => {
    const g = structuredClone(scholarshipGraph);
    g.edges[0].target = 'missing';
    expect(() => parseGraph(g)).toThrow(/missing|reference/i);
  });
  it('rejects duplicate node IDs', () => {
    const g = structuredClone(scholarshipGraph);
    g.nodes[1].id = g.nodes[0].id;
    expect(() => parseGraph(g)).toThrow(/duplicate/i);
  });
  it('rejects unsupported executable fields', () =>
    expect(() => parseGraph({ ...scholarshipGraph, script: 'alert(1)' })).toThrow());
  it('rejects out-of-bounds source regions', () => {
    const g = structuredClone(scholarshipGraph);
    g.nodes[0].x = -200;
    expect(() => parseGraph(g)).toThrow();
  });
  it('rejects non-finite dimensions', () =>
    expect(() => parseGraph({ ...scholarshipGraph, width: Infinity })).toThrow());
  it('rejects unknown node types', () => {
    const g = structuredClone(scholarshipGraph);
    expect(() => parseGraph({ ...g, nodes: [{ ...g.nodes[0], type: 'script' }] })).toThrow();
  });
});
describe('graph reasoning', () => {
  it('finds all reachable outcomes', () => {
    const ids = reachable(scholarshipGraph, 'start');
    expect(ids.has('approved')).toBe(true);
    expect(ids.has('declined')).toBe(true);
  });
  it('returns an empty set for an unknown start', () =>
    expect(reachable(scholarshipGraph, 'absent').size).toBe(0));
  it('terminates on cycles and reports them', () => {
    const g = structuredClone(scholarshipGraph);
    g.edges.push({
      id: 'loop',
      source: 'income',
      target: 'start',
      label: 'Retry',
      review: 'confirmed',
    });
    expect(reachable(g, 'start').size).toBe(g.nodes.length);
    expect(analyzeGraph(g).cycles.length).toBeGreaterThan(0);
  });
  it('reports isolated nodes', () => {
    const g = structuredClone(scholarshipGraph);
    g.nodes.push({ ...g.nodes[0], id: 'island', label: 'Isolated' });
    expect(analyzeGraph(g).unreachable).toContain('island');
  });
  it('explains outgoing branch labels', () => {
    const text = describeNode(scholarshipGraph, 'income');
    expect(text).toMatch(/Yes/);
    expect(text).toMatch(/No/);
  });
  it('finds an actual shortest path', () => {
    const path = shortestPath(scholarshipGraph, 'start', 'approved');
    expect(path[0]).toBe('start');
    expect(path.at(-1)).toBe('approved');
    expect(path.length).toBeGreaterThan(2);
  });
  it('returns no invented path when disconnected', () => {
    const g = structuredClone(scholarshipGraph);
    g.edges = g.edges.filter((e) => e.target !== 'approved');
    expect(shortestPath(g, 'start', 'approved')).toEqual([]);
  });
  it('reports a redirected edge and lost outcome', () => {
    const changed = structuredClone(scholarshipGraph);
    changed.edges = changed.edges.map((e) =>
      e.target === 'approved' ? { ...e, target: 'declined' } : e,
    );
    const d = diffGraphs(scholarshipGraph, changed);
    expect(d.changedEdges.length).toBeGreaterThan(0);
    expect(d.lostOutcomes).toContain('approved');
  });
  it('does not treat edge ordering as a change', () => {
    const g = structuredClone(scholarshipGraph);
    g.edges.reverse();
    expect(diffGraphs(scholarshipGraph, g).changedEdges).toEqual([]);
  });
  it('detects renamed and added nodes', () => {
    const g = structuredClone(scholarshipGraph);
    g.nodes[0].label = 'Begin';
    g.nodes.push({ ...g.nodes[0], id: 'new' });
    const d = diffGraphs(scholarshipGraph, g);
    expect(d.changedNodes).toContain('start');
    expect(d.addedNodes).toContain('new');
  });
  it('reports pending review separately', () => {
    const g = structuredClone(scholarshipGraph);
    g.edges[0].review = 'inferred';
    expect(analyzeGraph(g).pendingReview).toBe(1);
  });
});
