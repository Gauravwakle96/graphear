import { describe, it, expect } from 'vitest';
import { validateAnalysis, validateDiagram, validateTutor } from './study';
import { studyMermaid, studySvg } from './study-render';
import { testSources, testAnalysis, testDiagram } from './study.test-support';
describe('learning data trust boundary', () => {
  it('validates each supported diagram category without converting its notation', () => {
    for (const kind of [
      'flowchart',
      'network',
      'circuit',
      'scientific',
      'uml',
      'mindmap',
      'block',
      'er',
      'sequence',
      'class',
      'concept',
      'timeline',
      'process',
    ] as const) {
      const d = testDiagram(kind);
      expect(validateDiagram(d, new Set(['text0'])).kind).toBe(kind);
    }
  });
  it('rejects invented evidence and absent diagram endpoints', () => {
    const a = testAnalysis();
    a.notes.detailed[0].items[0].evidence = ['unknown'];
    expect(() => validateAnalysis(a, testSources)).toThrow(/source/);
    const d = testDiagram();
    d.edges[0].target = 'absent';
    expect(() => validateDiagram(d, new Set(['text0']))).toThrow(/connection/);
  });
  it('rejects invalid component ports and duplicate IDs', () => {
    const d = testDiagram('circuit');
    d.edges[0].sourcePort = 'positive';
    expect(() => validateDiagram(d, new Set(['text0']))).toThrow(/port/);
    const a = testAnalysis();
    a.questions.push(a.questions[0]);
    expect(() => validateAnalysis(a, testSources)).toThrow(/Duplicate/);
  });
  it('rejects unsupported answer options and ungrounded source claims', () => {
    const a = testAnalysis();
    a.questions[0].answer = 'Invented';
    expect(() => validateAnalysis(a, testSources)).toThrow(/options/);
    a.questions[0].answer = 'Client';
    a.notes.detailed[0].items[0].evidence = [];
    expect(() => validateAnalysis(a, testSources)).toThrow(/evidence/);
  });
  it('prevents a model from certifying its own reconstruction', () => {
    const a = testAnalysis();
    a.diagrams[0].reviewed = true;
    expect(validateAnalysis(a, testSources).diagrams[0].reviewed).toBe(false);
  });
  it('requires tutor grounding or an explicit additional/uncertainty label', () =>
    expect(() =>
      validateTutor(
        {
          answer: 'Unsupported certainty',
          evidence: [],
          additionalExplanation: false,
          uncertain: false,
          diagram: null,
        },
        testSources,
      ),
    ).toThrow(/reference/));
  it('escapes SVG text and refuses flowchart conversion for scientific/circuit/UML', () => {
    const d = testDiagram();
    d.nodes[0].label = '<script>alert(1)</script>';
    const svg = studySvg(d);
    expect(svg).not.toContain('<script>');
    expect(svg).toContain('&lt;script&gt;');
    for (const kind of ['scientific', 'circuit', 'uml', 'er', 'class', 'timeline'] as const)
      expect(studyMermaid(testDiagram(kind))).toBeNull();
  });
});
