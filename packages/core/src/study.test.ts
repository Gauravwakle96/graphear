import { describe, it, expect } from 'vitest';
import {
  validateAnalysis,
  validateDiagram,
  validateTutor,
  gradeStudyTest,
  studyGenerationSchema,
  optionsSchema,
} from './study';
import { studyMermaid, studySvg } from './study-render';
import { testSources, testAnalysis, testDiagram } from './study.test-support';
describe('learning data trust boundary', () => {
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
