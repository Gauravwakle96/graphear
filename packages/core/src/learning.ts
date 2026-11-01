import { outgoing, shortestPath, startNode, diffGraphs, type Graph } from './graph';
import { scholarshipGraph } from './samples';
export type Question = {
  id: string;
  prompt: string;
  options: { value: string; label: string }[];
  answer: string;
  explanation: string;
};
export function createQuestions(graph: Graph): Question[] {
  const questions: Question[] = [];
  const decision = graph.nodes.find(
    (n) => n.type === 'decision' && outgoing(graph, n.id).length > 0,
  );
  if (decision) {
    const edge = outgoing(graph, decision.id)[0];
    const target = graph.nodes.find((n) => n.id === edge.target)!;
    const options = graph.nodes
      .filter((n) => n.id !== decision.id && n.id !== target.id)
      .slice(0, 5);
    options.splice(Math.min(1, options.length), 0, target);
    questions.push({
      id: `branch-${decision.id}`,
      prompt: `From “${decision.label}”, which step follows the “${edge.label || 'next'}” connection?`,
      options: options.map((n) => ({ value: n.id, label: n.label })),
      answer: target.id,
      explanation: `The “${edge.label || 'next'}” connection goes from “${decision.label}” to “${target.label}”.`,
    });
  }
  const start = startNode(graph);
  const end = graph.nodes.find(
    (n) => n.type === 'end' && shortestPath(graph, start.id, n.id).length > 0,
  );
  if (end) {
    const path = shortestPath(graph, start.id, end.id);
    const text = path.map((id) => graph.nodes.find((n) => n.id === id)!.label).join(' → ');
    questions.push({
      id: `path-${end.id}`,
      prompt: `How many connections are on a shortest path from “${start.label}” to “${end.label}”?`,
      options: [
        ...new Set([Math.max(0, path.length - 2), path.length - 1, path.length, path.length + 1]),
      ].map((n) => ({ value: String(n), label: `${n} connection${n === 1 ? '' : 's'}` })),
      answer: String(path.length - 1),
      explanation: `${text}. This path contains ${path.length - 1} connections.`,
    });
  }
  return questions;
}
export function checkAnswer(question: Question, answer: string) {
  return { correct: answer === question.answer, explanation: question.explanation };
}
export function repairGraph(): Graph {
  const graph = structuredClone(scholarshipGraph);
  graph.id = 'repair-scholarship';
  graph.title = 'Repair the missing approval route';
  graph.edges = graph.edges.filter((e) => e.id !== 'verify');
  return graph;
}
export function checkRepair(graph: Graph) {
  const diff = diffGraphs(scholarshipGraph, graph);
  const expected = scholarshipGraph.edges
    .map((e) => JSON.stringify([e.source, e.target, e.label]))
    .sort();
  const actual = graph.edges.map((e) => JSON.stringify([e.source, e.target, e.label])).sort();
  const intact =
    graph.nodes.length === scholarshipGraph.nodes.length &&
    scholarshipGraph.nodes.every((n) =>
      graph.nodes.some((m) => m.id === n.id && m.label === n.label && m.type === n.type),
    );
  const correct = JSON.stringify(expected) === JSON.stringify(actual) && intact;
  return {
    correct,
    message: correct
      ? 'Mission complete. Document verification now leads to approval, and both eligibility decisions remain intact.'
      : 'Connect “Verify documents” to “Application approved” with the label “Complete”, while preserving the other branches and step meanings.',
    missingConnections: diff.removedEdges.length,
  };
}
