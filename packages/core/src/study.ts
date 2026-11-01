import { z } from 'zod';
const id = z
  .string()
  .min(1)
  .max(80)
  .regex(/^[a-zA-Z0-9_-]+$/);
const text = z.string().trim().min(1).max(4000);
const evidence = z.array(id).max(20);
export const sourceRelationSchema = z
  .object({
    source: z.string().trim().min(1).max(250),
    target: z.string().trim().min(1).max(250),
    relation: z.enum([
      'flow',
      'connection',
      'message',
      'association',
      'dependency',
      'contains',
      'is-a',
      'electrical',
    ]),
    direction: z.enum(['forward', 'both', 'none']),
  })
  .strict();
export const sourceOrderSchema = z
  .object({
    label: z.string().trim().min(1).max(250),
    components: z.array(z.string().trim().min(1).max(250)).min(2).max(40),
    relation: z.enum(['flow', 'association']),
    direction: z.enum(['forward', 'none']),
  })
  .strict();
export const categorySchema = z.enum([
  'flowchart',
  'mindmap',
  'block',
  'uml',
  'er',
  'network',
  'circuit',
  'sequence',
  'class',
  'concept',
  'timeline',
  'scientific',
  'process',
]);
export const sourceSchema = z
  .object({
    id,
    reference: z.string().max(150),
    kind: z.enum(['text', 'page', 'slide', 'image', 'audio', 'frame', 'transcript']),
    text: z.string().max(16000),
    visualLabels: z.array(z.string().trim().min(1).max(250)).max(80).optional(),
    conceptLabels: z.array(z.string().trim().min(1).max(250)).max(80).optional(),
    conceptRelations: z.array(sourceRelationSchema).max(100).optional(),
    conceptOrders: z.array(sourceOrderSchema).max(12).optional(),
    page: z.number().int().positive().nullable(),
    start: z.number().nonnegative().nullable(),
    end: z.number().nonnegative().nullable(),
    asset: z.string().max(150).nullable(),
  })
  .strict();
export const noteItemSchema = z
  .object({ text, origin: z.enum(['source', 'additional', 'uncertain']), evidence })
  .strict();
const section = z
  .object({ heading: z.string().max(150), items: z.array(noteItemSchema).min(1).max(20) })
  .strict();
export const studyNodeSchema = z
  .object({
    id,
    label: z.string().min(1).max(250),
    role: z.enum([
      'start',
      'end',
      'process',
      'decision',
      'component',
      'entity',
      'actor',
      'concept',
      'event',
    ]),
    shape: z.enum(['rectangle', 'ellipse', 'diamond']),
    symbol: z.enum([
      'none',
      'resistor',
      'capacitor',
      'battery',
      'ground',
      'switch',
      'lamp',
      'diode',
    ]),
    position: z
      .object({ x: z.number().min(0).max(4096), y: z.number().min(0).max(4096) })
      .strict()
      .nullable(),
    attributes: z
      .array(
        z
          .object({ name: z.string().max(100), type: z.string().max(80), key: z.boolean() })
          .strict(),
      )
      .max(20),
    methods: z.array(z.string().max(150)).max(20),
    ports: z.array(id).max(12),
    evidence,
  })
  .strict();
export const studyEdgeSchema = z
  .object({
    id,
    source: id,
    target: id,
    label: z.string().max(200),
    relation: z.enum([
      'flow',
      'connection',
      'message',
      'association',
      'dependency',
      'contains',
      'is-a',
      'electrical',
    ]),
    direction: z.enum(['forward', 'both', 'none']),
    sourcePort: id.nullable(),
    targetPort: id.nullable(),
    evidence,
  })
  .strict();
export const studyDiagramSchema = z
  .object({
    id,
    title: z.string().min(1).max(180),
    kind: categorySchema,
    description: text,
    nodes: z.array(studyNodeSchema).min(1).max(80),
    edges: z.array(studyEdgeSchema).max(150),
    warnings: z.array(z.string().max(500)).max(15),
    reviewed: z.boolean(),
  })
  .strict();
export const questionSchema = z
  .object({
    id,
    kind: z.enum(['mcq', 'fill', 'truefalse', 'short', 'long']),
    prompt: text,
    options: z.array(z.string().max(500)).max(6),
    answer: text,
    explanation: text,
    evidence,
    difficulty: z.enum(['easy', 'medium', 'hard']),
  })
  .strict();
export const flashcardSchema = z.object({ id, front: text, back: text, evidence }).strict();
export const studyTableSchema = z
  .object({
    title: z.string().min(1).max(180),
    columns: z.array(z.string().min(1).max(150)).min(1).max(8),
    rows: z.array(z.array(z.string().max(1000)).max(8)).max(30),
    evidence,
  })
  .strict();
export const analysisSchema = z
  .object({
    title: z.string().min(1).max(180),
    category: categorySchema,
    summary: text,
    topics: z.array(z.object({ title: z.string().max(180), evidence }).strict()).max(40),
    notes: z
      .object({
        detailed: z.array(section).min(1).max(18),
        short: z.array(section).min(1).max(10),
        exam: z.array(section).min(1).max(12),
      })
      .strict(),
    diagrams: z.array(studyDiagramSchema).max(12),
    tables: z.array(studyTableSchema).max(8),
    flashcards: z.array(flashcardSchema).max(30),
    questions: z.array(questionSchema).max(30),
    sourceObservations: z
      .array(z.object({ sourceId: id, text: z.string().max(16000) }).strict())
      .max(80),
    warnings: z.array(z.string().max(600)).max(20),
  })
  .strict();
export const tutorSchema = z
  .object({
    answer: text,
    evidence,
    additionalExplanation: z.boolean(),
    uncertain: z.boolean(),
    diagram: studyDiagramSchema.nullable(),
  })
  .strict();
export const optionsSchema = z
  .object({
    subject: z.string().trim().max(150).default('General education'),
    difficulty: z.enum(['easy', 'medium', 'hard']).default('medium'),
    questionCount: z.number().int().min(1).max(20).default(5),
    consent: z.literal(true),
    noteStyle: z.enum(['detailed', 'short', 'exam']).default('detailed'),
    learningLevel: z.enum(['beginner', 'school', 'college', 'advanced']).optional(),
    learningGoal: z.enum(['understand', 'exam', 'revision']).optional(),
    visualAnalysis: z.boolean().optional(),
    diagramKind: z.enum(['auto', ...categorySchema.options]).optional(),
    diagramDetail: z.enum(['faithful', 'simple', 'expanded']).optional(),
    notesLayout: z.enum(['bullets', 'prose']).optional(),
    useCase: z.enum(['study', 'scholarship', 'hackathon', 'process']).optional(),
    instructions: z.string().trim().max(2000).optional(),
  })
  .strict();
export type Source = z.infer<typeof sourceSchema>;
export type StudyAnalysis = z.infer<typeof analysisSchema>;
export type StudyDiagram = z.infer<typeof studyDiagramSchema>;
export type StudyNode = z.infer<typeof studyNodeSchema>;
export type StudyOptions = z.infer<typeof optionsSchema>;
export type StudyQuestion = z.infer<typeof questionSchema>;
export type TutorAnswer = z.infer<typeof tutorSchema>;
export function studyOverview(diagram: StudyDiagram): StudyDiagram | null {
  const nodes = diagram.nodes.filter((n) => n.methods.length > 0);
  if (diagram.kind === 'mindmap' || nodes.length < 2 || nodes.length === diagram.nodes.length)
    return null;
  const ids = new Set(nodes.map((n) => n.id));
  const edges = diagram.edges.filter((e) => ids.has(e.source) && ids.has(e.target));
  if (!edges.length) return null;
  return {
    ...diagram,
    id: diagram.id.slice(0, 71) + '-overview',
    title: diagram.title.slice(0, 169) + ' · Overview',
    description:
      diagram.description.slice(0, 3800) +
      ' This overview shows the explained primary components; the complete diagram retains the remaining inventoried concepts.',
    nodes,
    edges,
  };
}
export function substantialStudySources(sources: Source[]) {
  const length = sources.reduce((n, src) => n + src.text.length, 0);
  return (
    sources.length >= 5 &&
    (length >= 6000 ||
      sources.filter((s) => s.kind === 'transcript' && s.text.length >= 80).length >= 5)
  );
}
export function studyGenerationSchema(options: StudyOptions, sources: Source[]) {
  const substantial = substantialStudySources(sources);
  const expandedImage =
    options.noteStyle === 'detailed' &&
    options.diagramDetail === 'expanded' &&
    sources.some((s) => s.kind === 'image');
  const detailedMaterial =
    sources.reduce((n, s) => n + s.text.length, 0) >= 2000 ||
    new Set(sources.flatMap((s) => s.conceptLabels ?? [])).size >= 6;
  return analysisSchema.extend({
    notes:
      substantial || expandedImage || detailedMaterial
        ? analysisSchema.shape.notes.extend({
            detailed: z
              .array(section.extend({ items: section.shape.items.min(2) }))
              .min(substantial ? 6 : 4)
              .max(18),
          })
        : analysisSchema.shape.notes,
    questions: z.array(questionSchema).length(options.questionCount),
  });
}
export const quizSubmissionSchema = z
  .object({
    answers: z.record(z.string().max(80), z.string().max(4000)),
    mode: z.enum(['practice', 'timed']).default('practice'),
    durationSeconds: z.number().int().min(0).max(7200).optional(),
    timeLimitSeconds: z.number().int().min(60).max(7200).optional(),
  })
  .strict();
export type StudyQuestionResult = {
  questionId: string;
  prompt: string;
  kind: StudyQuestion['kind'];
  givenAnswer: string;
  answer: string;
  explanation: string;
  evidence: string[];
  correct: boolean | null;
};
export function gradeStudyTest(
  questions: StudyQuestion[],
  answers: Record<string, string>,
  allowUnanswered = false,
) {
  if (Object.keys(answers).some((id) => !questions.some((q) => q.id === id)))
    throw new Error('Answers contain a question outside the current test');
  if (!allowUnanswered && questions.some((q) => !answers[q.id]?.trim()))
    throw new Error('Answer each question in the current test');
  const results: StudyQuestionResult[] = questions.map((q) => ({
    questionId: q.id,
    prompt: q.prompt,
    kind: q.kind,
    givenAnswer: answers[q.id] ?? '',
    answer: q.answer,
    explanation: q.explanation,
    evidence: q.evidence,
    correct: ['mcq', 'truefalse'].includes(q.kind) ? answers[q.id] === q.answer : null,
  }));
  return {
    results,
    total: results.filter((r) => r.correct !== null).length,
    correct: results.filter((r) => r.correct === true).length,
  };
}
export function validateDiagram(value: unknown, sourceIds: Set<string>) {
  const d = studyDiagramSchema.parse(value);
  const nodes = new Set<string>(),
    edges = new Set<string>();
  for (const n of d.nodes) {
    if (nodes.has(n.id)) throw new Error('Duplicate diagram node ID');
    nodes.add(n.id);
    if (new Set(n.ports).size !== n.ports.length) throw new Error('Duplicate component port');
    validateEvidence(n.evidence, sourceIds);
    if (!n.evidence.length && !d.warnings.length)
      throw new Error('Diagram component has no source reference or uncertainty warning');
  }
  for (const e of d.edges) {
    if (
      e.relation === 'contains' &&
      /^(stack[- ]?order|data[- ]?(flow|exchange)|next[- ]?step|sequence)$/i.test(e.label.trim())
    )
      throw new Error(
        'A sequence or data-flow relationship cannot use whole-part containment. Use flow for data movement or association for conceptual order.',
      );
    if (edges.has(e.id) || !nodes.has(e.source) || !nodes.has(e.target))
      throw new Error('Invalid diagram connection');
    edges.add(e.id);
    for (const [nodeId, port] of [
      [e.source, e.sourcePort],
      [e.target, e.targetPort],
    ] as const)
      if (port && !d.nodes.find((n) => n.id === nodeId)!.ports.includes(port))
        throw new Error('Invalid circuit/component port');
    validateEvidence(e.evidence, sourceIds);
    if (!e.evidence.length && !d.warnings.length)
      throw new Error('Diagram relationship has no source reference or uncertainty warning');
  }
  return d;
}
export function validateEvidence(refs: string[], sources: Set<string>) {
  if (new Set(refs).size !== refs.length) throw new Error('Duplicate source reference');
  if (refs.some((ref) => !sources.has(ref)))
    throw new Error('AI response references a source that does not exist');
}
export function validateAnalysis(value: unknown, sources: Source[]) {
  const a = analysisSchema.parse(value),
    ids = new Set(sources.map((s) => s.id));
  for (const format of Object.values(a.notes))
    for (const section of format)
      for (const item of section.items) {
        validateEvidence(item.evidence, ids);
        if (item.origin === 'source' && !item.evidence.length)
          throw new Error('Source-based note has no evidence');
      }
  for (const d of a.diagrams) validateDiagram(d, ids);
  if (new Set(a.diagrams.map((d) => d.id)).size !== a.diagrams.length)
    throw new Error('Duplicate diagram ID');
  for (const table of a.tables) {
    validateEvidence(table.evidence, ids);
    if (!table.evidence.length || table.rows.some((r) => r.length !== table.columns.length))
      throw new Error('Invalid source-linked table');
  }
  for (const kind of [a.questions, a.flashcards])
    if (new Set(kind.map((v) => v.id)).size !== kind.length)
      throw new Error('Duplicate practice item ID');
  for (const q of a.questions) {
    if (!q.evidence.length) throw new Error('Practice question has no source reference');
    validateEvidence(q.evidence, ids);
    if (['mcq', 'truefalse'].includes(q.kind) ? q.options.length < 2 : q.options.length !== 0)
      throw new Error('Question options do not match its kind');
    if (['mcq', 'truefalse'].includes(q.kind) && !q.options.includes(q.answer))
      throw new Error('Question answer is missing from its options');
  }
  for (const f of a.flashcards) {
    if (!f.evidence.length) throw new Error('Flashcard has no source reference');
    validateEvidence(f.evidence, ids);
  }
  for (const t of a.topics) validateEvidence(t.evidence, ids);
  for (const o of a.sourceObservations) validateEvidence([o.sourceId], ids);
  for (const d of a.diagrams) d.reviewed = false;
  return a;
}
// Inventory matching checks coverage, not factual or scientific correctness.
export function validateVisualCoverage(
  a: StudyAnalysis,
  sources: Source[],
  options: StudyOptions,
  scope: 'all' | 'notes' | 'diagrams' = 'all',
) {
  const normalize = (v: string) =>
    v
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, ' ')
      .trim();
  const diagrams = a.diagrams.flatMap((d) => d.nodes.map((n) => normalize(n.label)));
  const notes = a.notes[options.noteStyle].flatMap((s) =>
    s.items.map((item) => normalize(item.text)),
  );
  const includesLabel = (items: string[], label: string) => {
    const words = normalize(label).split(' ');
    const singular = (word: string) => {
      if (word === 'media') return 'medium';
      if (word.endsWith('ies')) return word.slice(0, -3) + 'y';
      if (/(sses|shes|ches|xes|zes)$/.test(word)) return word.slice(0, -2);
      return word.length > 3 && word.endsWith('s') && !word.endsWith('ss')
        ? word.slice(0, -1)
        : word;
    };
    return items.some((item) =>
      words.every((word) => item.split(' ').some((w) => singular(w) === singular(word))),
    );
  };
  const warnings = [...a.warnings, ...a.diagrams.flatMap((d) => d.warnings)]
    .filter((w) => /omitt|unreadable|illegible|unavailable|not visible/i.test(w))
    .map(normalize);
  const missing = sources.flatMap((s) =>
    [...(s.visualLabels ?? []), ...(s.conceptLabels ?? [])].flatMap((label) => {
      const key = normalize(label);
      if (warnings.some((w) => w.includes(key))) return [];
      const areas = [
        ...(scope !== 'diagrams' && options.noteStyle === 'detailed' && !includesLabel(notes, label)
          ? ['detailed notes']
          : []),
        ...(scope !== 'notes' &&
        options.diagramDetail !== 'simple' &&
        !includesLabel(diagrams, label)
          ? ['diagrams']
          : []),
      ];
      return areas.length ? [`${label} (${areas.join(', ')})`] : [];
    }),
  );
  if (missing.length)
    throw new Error(
      'Source coverage is incomplete. Include these inventoried components or explicitly identify unreadable/omitted items in warnings: ' +
        [...new Set(missing)].join('; '),
    );
  if (scope !== 'diagrams' && options.noteStyle === 'detailed') {
    const cited = new Set(a.notes.detailed.flatMap((s) => s.items.flatMap((i) => i.evidence)));
    const omittedTopics = sources.filter(
      (s) => s.kind === 'transcript' && s.text.trim().length >= 80 && !cited.has(s.id),
    );
    if (omittedTopics.length)
      throw new Error(
        'Detailed notes omitted source topics: ' + omittedTopics.map((s) => s.id).join(', '),
      );
  }
  if (scope !== 'notes') {
    const relationships = sources.flatMap((s) => [
      ...(s.conceptRelations ?? []),
      ...(s.conceptOrders ?? []).flatMap((order) =>
        order.components.slice(1).map((target, i) => ({
          source: order.components[i],
          target,
          relation: order.relation,
          direction: order.direction,
        })),
      ),
    ]);
    const absent = relationships.filter(
      (r) =>
        !a.diagrams.some((d) => {
          const from = d.nodes.filter((n) => includesLabel([normalize(n.label)], r.source));
          const to = d.nodes.filter((n) => includesLabel([normalize(n.label)], r.target));
          // A conceptual mind map may organize a process under a common topic.
          // Preserve the actual direct relationships in other requested formats.
          if (d.kind === 'mindmap') {
            const adjacent = new Map(d.nodes.map((n) => [n.id, new Set<string>()]));
            d.edges.forEach((e) => {
              adjacent.get(e.source)?.add(e.target);
              adjacent.get(e.target)?.add(e.source);
            });
            return from.some((f) => {
              const seen = new Set<string>(),
                pending = [f.id];
              while (pending.length) {
                const id = pending.pop()!;
                if (seen.has(id)) continue;
                seen.add(id);
                pending.push(...(adjacent.get(id) ?? []));
              }
              return to.some((t) => seen.has(t.id));
            });
          }
          return d.edges.some(
            (e) =>
              (from.some((n) => n.id === e.source) &&
                to.some((n) => n.id === e.target) &&
                e.relation === r.relation &&
                (r.direction === 'none' ||
                  e.direction === r.direction ||
                  e.direction === 'both')) ||
              (r.direction !== 'forward' &&
                e.relation === r.relation &&
                to.some((n) => n.id === e.source) &&
                from.some((n) => n.id === e.target)),
          );
        }),
    );
    if (absent.length)
      throw new Error(
        'Diagram omitted source relationships: ' +
          absent.map((r) => `${r.source} → ${r.target} (${r.relation})`).join('; '),
      );
  }
  return a;
}
export function validateTutor(value: unknown, sources: Source[]) {
  const a = tutorSchema.parse(value),
    ids = new Set(sources.map((s) => s.id));
  validateEvidence(a.evidence, ids);
  if (!a.evidence.length && !a.additionalExplanation && !a.uncertain)
    throw new Error('Tutor answer has no source reference');
  if (a.diagram) {
    a.diagram = validateDiagram(a.diagram, ids);
    a.diagram.reviewed = false;
  }
  return a;
}
export const timestamp = (seconds: number) =>
  `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
export function studyMarkdown(
  a: StudyAnalysis,
  sources: Source[],
  format: 'detailed' | 'short' | 'exam' = 'detailed',
) {
  const refs = new Map(sources.map((s) => [s.id, s.reference]));
  return `# ${a.title}\n\n${a.summary}\n\n${a.notes[format].map((s) => `## ${s.heading}\n\n${s.items.map((i) => `- ${i.text}${i.origin !== 'source' ? ` [${i.origin}]` : ''}${i.evidence.length ? ` (${i.evidence.map((e) => refs.get(e) ?? e).join('; ')})` : ''}`).join('\n')}`).join('\n\n')}\n\n## Source coverage and warnings\n\n${a.warnings.map((w) => '- ' + w).join('\n')}\n${a.tables.map((t) => `\n## ${t.title}\n\n| ${t.columns.map((c) => c.replaceAll('|', '\\|')).join(' | ')} |\n| ${t.columns.map(() => '---').join(' | ')} |\n${t.rows.map((r) => '| ' + r.map((v) => v.replaceAll('|', '\\|').replaceAll('\n', ' ')).join(' | ') + ' |').join('\n')}`).join('\n')}\n`;
}
