import { describe, it, expect } from 'vitest';
import {
  validateAnalysis,
  validateVisualCoverage,
  validateDiagram,
  validateTutor,
  gradeStudyTest,
  studyGenerationSchema,
  optionsSchema,
  substantialStudySources,
  studyOverview,
} from './study';
import { studyMermaid, studySvg, diagramPositions } from './study-render';
import { testSources, testAnalysis, testDiagram } from './study.test-support';
describe('learning data trust boundary', () => {
  it('rejects sequence connections mislabeled as whole-part containment', () => {
    const d = testDiagram();
    d.edges[0].relation = 'contains';
    d.edges[0].label = 'stack-order';
    expect(() => validateDiagram(d, new Set(['text0']))).toThrow(/whole-part/);
    d.edges[0].relation = 'association';
    expect(validateDiagram(d, new Set(['text0']))).toBeTruthy();
  });
  it('derives a readable overview without adding relationships or losing the complete diagram', () => {
    const d = testDiagram();
    d.nodes.forEach((n) => {
      n.methods = ['Source-defined explanation'];
    });
    d.nodes.push({
      ...structuredClone(d.nodes[0]),
      id: 'detail',
      label: 'Source detail',
      methods: [],
    });
    const overview = studyOverview(d)!;
    expect(overview.nodes).toHaveLength(2);
    expect(overview.edges).toEqual(d.edges);
    expect(d.nodes).toHaveLength(3);
    expect(validateDiagram(overview, new Set(['text0']))).toBeTruthy();
  });
  it('rejects disconnected diagrams even when all source concept names are present', () => {
    const options = optionsSchema.parse({ consent: true });
    const sources = testSources.map((s) => ({
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
    const result = testAnalysis();
    expect(validateVisualCoverage(result, sources, options)).toBe(result);
    result.diagrams[0].edges = [];
    expect(() => validateVisualCoverage(result, sources, options)).toThrow(/relationships/);
    result.diagrams[0].edges = [{ ...testDiagram().edges[0], source: 'server', target: 'client' }];
    expect(() => validateVisualCoverage(result, sources, options)).toThrow(/relationships/);
  });
  it('requires later video topics in detailed notes, even when a transcript is compact', () => {
    const sources = Array.from({ length: 5 }, (_, i) => ({
      ...testSources[0],
      id: i ? 'video' + i : 'text0',
      kind: 'transcript' as const,
      text: testSources[0].text + ' More source teaching.',
    }));
    expect(substantialStudySources(sources)).toBe(true);
    expect(
      studyGenerationSchema(
        optionsSchema.parse({ consent: true, questionCount: 1 }),
        sources,
      ).safeParse(testAnalysis()).success,
    ).toBe(false);
    expect(() =>
      validateVisualCoverage(testAnalysis(), sources, optionsSchema.parse({ consent: true })),
    ).toThrow(/omitted source topics/);
  });
  it('does not treat a technical correction warning as permission to omit that component', () => {
    const sources = testSources.map((s) => ({ ...s, conceptLabels: ['Gateway'] }));
    const result = testAnalysis();
    result.warnings = ['Gateway protocol grouping may be technically incorrect.'];
    expect(() =>
      validateVisualCoverage(result, sources, optionsSchema.parse({ consent: true })),
    ).toThrow(/Gateway/);
  });
  it('accepts ordinary plural forms in source coverage while rejecting unrelated terms', () => {
    const result = testAnalysis();
    result.notes.detailed[0].items[0].text =
      'IP addresses identify hosts; transmission media carry signals.';
    const sources = testSources.map((s) => ({
      ...s,
      conceptLabels: ['IP address', 'Transmission medium'],
    }));
    expect(
      validateVisualCoverage(result, sources, optionsSchema.parse({ consent: true }), 'notes'),
    ).toBe(result);
  });
  it('lays out a new mind-map hierarchy without losing its connections', () => {
    const diagram = testDiagram('mindmap');
    diagram.nodes.forEach((n) => {
      n.position = null;
    });
    diagram.edges = [diagram.edges[0]];
    const result = diagramPositions(diagram);
    expect(result.nodes[1].position!.x).toBeGreaterThan(result.nodes[0].position!.x);
    expect(result.edges).toEqual(diagram.edges);
    expect(result.nodes.every((n) => n.position!.x <= 4096 && n.position!.y <= 4096)).toBe(true);
  });
  it('rejects diagrams that silently omit inventoried source components', () => {
    const options = optionsSchema.parse({ consent: true });
    const sources = testSources.map((s) => ({
      ...s,
      visualLabels: ['Client', 'Server', 'Gateway'],
    }));
    expect(() => validateVisualCoverage(testAnalysis(), sources, options)).toThrow(/Gateway/);
    const complete = testAnalysis();
    complete.diagrams[0].nodes.push({
      ...structuredClone(complete.diagrams[0].nodes[0]),
      id: 'gateway',
      label: 'Gateway',
    });
    complete.notes.detailed[0].items[0].text += ' Gateway is a named source component.';
    expect(validateVisualCoverage(complete, sources, options)).toBe(complete);
    const uncertain = testAnalysis();
    uncertain.warnings = ['Gateway was omitted because its label/connection is unreadable.'];
    expect(validateVisualCoverage(uncertain, sources, options)).toBe(uncertain);
  });
  it('separates overlapping model positions without changing component meaning or connections', () => {
    const source = testDiagram();
    source.nodes[1].position = { ...source.nodes[0].position! };
    const result = diagramPositions(source);
    expect(result.edges).toEqual(source.edges);
    expect(result.nodes.map((n) => n.label)).toEqual(source.nodes.map((n) => n.label));
    expect(result.nodes[1].position!.x - result.nodes[0].position!.x).toBeGreaterThan(250);
    expect(result.warnings.join(' ')).toContain('Overlapping layout');
    expect(source.nodes[1].position).toEqual(source.nodes[0].position);
  });
  it('rejects a header-only short response for expanded image study notes', () => {
    const source = { ...testSources[0], kind: 'image' as const };
    const schema = studyGenerationSchema(
      optionsSchema.parse({
        consent: true,
        noteStyle: 'detailed',
        diagramDetail: 'expanded',
        questionCount: 1,
      }),
      [source],
    );
    expect(schema.safeParse(testAnalysis()).success).toBe(false);
  });
  it('bounds custom preferences and retains older option records', () => {
    expect(optionsSchema.parse({ consent: true }).diagramKind).toBeUndefined();
    expect(
      optionsSchema.parse({
        consent: true,
        diagramKind: 'network',
        diagramDetail: 'simple',
        notesLayout: 'bullets',
        useCase: 'scholarship',
        instructions: 'Explain eligibility',
      }),
    ).toMatchObject({ diagramKind: 'network', useCase: 'scholarship' });
    expect(optionsSchema.safeParse({ consent: true, instructions: 'x'.repeat(2001) }).success).toBe(
      false,
    );
    expect(optionsSchema.safeParse({ consent: true, diagramKind: 'execute-code' }).success).toBe(
      false,
    );
  });
  it('requires requested question counts and substantial study notes without restricting manual edits', () => {
    const options = {
      consent: true as const,
      subject: 'Networks',
      difficulty: 'easy' as const,
      questionCount: 2,
      noteStyle: 'detailed' as const,
    };
    expect(studyGenerationSchema(options, testSources).safeParse(testAnalysis()).success).toBe(
      false,
    );
    const large = Array.from({ length: 5 }, () => ({
      ...testSources[0],
      text: 'Educational source material. '.repeat(60),
    }));
    const minimum = studyGenerationSchema({ ...options, questionCount: 1 }, large);
    expect(minimum.safeParse(testAnalysis()).success).toBe(false);
    expect(validateAnalysis(testAnalysis(), testSources)).toBeTruthy();
  });
  it('grades choices on the server rules and retains written-answer self-review', () => {
    const choice = testAnalysis().questions[0];
    const written = { ...choice, id: 'written', kind: 'short' as const, options: [] };
    const result = gradeStudyTest([choice, written], {
      [choice.id]: choice.answer,
      written: 'My explanation',
    });
    expect(result).toMatchObject({ correct: 1, total: 1 });
    expect(result.results[1].correct).toBeNull();
    expect(result.results[0].explanation).toBe(choice.explanation);
    expect(gradeStudyTest([choice], {}, true)).toMatchObject({ correct: 0, total: 1 });
    expect(() => gradeStudyTest([choice], {})).toThrow(/each question/);
    expect(() => gradeStudyTest([choice], { foreign: 'fake' }, true)).toThrow(/outside/);
  });
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
