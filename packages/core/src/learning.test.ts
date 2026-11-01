import { describe, it, expect } from 'vitest';
import { createQuestions, checkAnswer, repairGraph, checkRepair } from './learning';
import { scholarshipGraph } from './samples';
import { createBlankGraph } from './graph';
describe('checked learning feedback', () => {
  it('creates questions grounded in existing edges', () => {
    const questions = createQuestions(scholarshipGraph);
    expect(questions.length).toBe(2);
    expect(questions[0].options.some((o) => o.value === questions[0].answer)).toBe(true);
  });
  it('checks correct and wrong responses', () => {
    const q = createQuestions(scholarshipGraph)[0];
    expect(checkAnswer(q, q.answer).correct).toBe(true);
    expect(checkAnswer(q, 'unknown').correct).toBe(false);
  });
  it('does not invent questions for a blank start', () =>
    expect(createQuestions(createBlankGraph())).toEqual([]));
  it('recognizes the broken mission', () => expect(checkRepair(repairGraph()).correct).toBe(false));
  it('accepts repaired topology with a new edge ID', () => {
    const g = repairGraph();
    g.edges.push({
      id: 'student-edge',
      source: 'documents',
      target: 'approved',
      label: 'Complete',
      review: 'confirmed',
    });
    expect(checkRepair(g).correct).toBe(true);
  });
  it('rejects bypassing eligibility decisions', () => {
    const g = repairGraph();
    g.edges.push({
      id: 'bypass',
      source: 'start',
      target: 'approved',
      label: 'Complete',
      review: 'confirmed',
    });
    expect(checkRepair(g).correct).toBe(false);
  });
  it('keeps the correct answer available in diagrams with many steps', () => {
    const g = structuredClone(scholarshipGraph);
    g.nodes.push({ ...g.nodes[0], id: 'last' });
    g.edges[1].target = 'last';
    const q = createQuestions(g)[0];
    expect(q.options.some((o) => o.value === q.answer)).toBe(true);
  });
  it('rejects repaired topology with changed eligibility meaning', () => {
    const g = structuredClone(scholarshipGraph);
    g.nodes[1].label = 'Bypass eligibility';
    expect(checkRepair(g).correct).toBe(false);
  });
});
