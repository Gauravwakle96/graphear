import { describe, it, expect } from 'vitest';
import { expandVisualMindMap, expandVisualDiagram, expandInventoryDiagram } from './visual-diagram';
import { testSources } from '../../../../packages/core/src/study.test-support';
const sources = testSources.map((s) => ({ ...s, kind: 'image' as const }));
const tree = () => ({
  title: 'Synthetic connected hierarchy',
  description: 'Test-only source hierarchy',
  nodes: [
    { id: 'root', label: 'Network lesson', parent: null, details: [] },
    { id: 'client', label: 'Client', parent: 'root', details: ['Sends requests'] },
    { id: 'server', label: 'Server', parent: 'root', details: ['Returns responses'] },
  ],
  warnings: [],
});
describe('compact visual reconstruction boundary', () => {
  it('restores every connection in a source-declared ordered group without invented model edges', () => {
    const input = sources.map((s) => ({
      ...s,
      conceptOrders: [
        {
          label: 'Source order',
          components: ['Client', 'Server'],
          relation: 'association' as const,
          direction: 'none' as const,
        },
      ],
    }));
    const d = expandInventoryDiagram(
      {
        title: 'Test order',
        kind: 'block',
        description: 'Synthetic only.',
        details: [],
        connections: [],
        warnings: [],
      },
      input,
      false,
    );
    expect(d.nodes.map((n) => n.label)).toEqual(['Client', 'Server']);
    expect(d.edges[0]).toMatchObject({
      relation: 'association',
      direction: 'none',
      label: 'Source order',
    });
  });
  it('creates source-inventoried nodes and preserves known relations without model padding or fabricated IDs', () => {
    const input = sources.map((s) => ({
      ...s,
      conceptLabels: ['Client', 'Server'],
      conceptRelations: [
        {
          source: 'Client',
          target: 'Server',
          relation: 'connection' as const,
          direction: 'forward' as const,
        },
      ],
    }));
    const output = {
      title: 'Synthetic source reconstruction',
      kind: 'network',
      description: 'Test only.',
      details: [],
      connections: [],
      warnings: [],
    };
    const d = expandInventoryDiagram(output, input, false);
    expect(d.nodes.map((n) => n.label)).toEqual(['Client', 'Server']);
    expect(d.edges).toHaveLength(1);
    expect(() =>
      expandInventoryDiagram(
        {
          ...output,
          connections: [
            {
              source: 'Practice Question 1',
              target: 'Server',
              label: '',
              relation: 'connection',
              direction: 'forward',
            },
          ],
        },
        input,
        false,
      ),
    ).toThrow();
  });
  it('requires exact parents for all inventoried mind-map labels and rejects cycles', () => {
    const input = sources.map((s) => ({ ...s, visualLabels: ['Client', 'Server'] }));
    const output = {
      title: 'Test tree',
      description: 'Synthetic only.',
      details: [],
      warnings: [],
      parents: [
        { label: '__topic__', parent: null },
        { label: 'Client', parent: null },
        { label: 'Server', parent: 'Client' },
      ],
    };
    output.parents[1].parent = '__topic__';
    expect(expandInventoryDiagram(output, input, true).edges).toHaveLength(2);
    expect(() =>
      expandInventoryDiagram(
        {
          ...output,
          parents: [
            { label: '__topic__', parent: null },
            { label: 'Client', parent: 'Server' },
            { label: 'Server', parent: 'Client' },
          ],
        },
        input,
        true,
      ),
    ).toThrow();
    expect(() =>
      expandInventoryDiagram(
        { ...output, parents: [output.parents[0], output.parents[1], output.parents[1]] },
        input,
        true,
      ),
    ).toThrow(/exactly once/);
  });
  it('renders every AI-declared tree parent with validated source references', () => {
    const d = expandVisualMindMap(tree(), sources);
    expect(d.nodes).toHaveLength(3);
    expect(d.edges).toHaveLength(2);
    expect(d.edges.map((e) => [e.source, e.target])).toEqual([
      ['root', 'client'],
      ['root', 'server'],
    ]);
    expect(d.nodes[1].methods).toEqual(['Sends requests']);
    expect(d.nodes.every((n) => n.evidence[0] === sources[0].id)).toBe(true);
    expect(d.reviewed).toBe(false);
  });
  it('rejects forests, missing parents, duplicate IDs and cycles rather than inventing connections', () => {
    const missing = tree();
    missing.nodes[1].parent = 'missing';
    expect(() => expandVisualMindMap(missing, sources)).toThrow(/missing parent/);
    const forest = tree();
    forest.nodes[1].parent = null;
    expect(() => expandVisualMindMap(forest, sources)).toThrow(/one root/);
    const cycle = tree();
    cycle.nodes[1].parent = 'server';
    cycle.nodes[2].parent = 'client';
    expect(() => expandVisualMindMap(cycle, sources)).toThrow(/cycle/);
    const duplicate = tree();
    duplicate.nodes[2].id = 'client';
    expect(() => expandVisualMindMap(duplicate, sources)).toThrow(/Duplicate/);
  });
  it('rejects invalid edges from compact node graphs before rendering', () => {
    expect(() =>
      expandVisualDiagram(
        {
          title: 'Test',
          kind: 'network',
          description: 'Test-only',
          nodes: [{ id: 'a', label: 'Client', details: [] }],
          edges: [
            {
              source: 'a',
              target: 'missing',
              label: 'request',
              relation: 'connection',
              direction: 'forward',
            },
          ],
          warnings: [],
        },
        sources,
      ),
    ).toThrow(/connection/);
  });
  it('retains timestamp source references when compact reconstruction is used for video', () => {
    const videoSources = sources.map((s) => ({
      ...s,
      kind: 'transcript' as const,
      conceptLabels: ['Client', 'Server'],
      start: 10,
      end: 60,
    }));
    const d = expandVisualMindMap(tree(), videoSources);
    expect(d.nodes.every((n) => n.evidence.includes(videoSources[0].id))).toBe(true);
    expect(d.edges.every((e) => e.evidence.includes(videoSources[0].id))).toBe(true);
  });
});
