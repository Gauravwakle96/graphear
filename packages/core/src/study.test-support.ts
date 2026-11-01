// Synthetic data for automated tests only. Never imported by application code.
import type { Source, StudyAnalysis, StudyDiagram } from './study';
export const testSources: Source[] = [
  {
    id: 'text0',
    reference: 'Text section 1',
    kind: 'text',
    text: 'A client sends a request to a server. The server sends a response to the client.',
    page: null,
    start: null,
    end: null,
    asset: null,
  },
];
export function testDiagram(kind: StudyDiagram['kind'] = 'network'): StudyDiagram {
  return {
    id: 'diagram1',
    title: 'Client and server',
    kind,
    description: 'A request and response between a client and server.',
    nodes: ['client', 'server'].map((id, i) => ({
      id,
      label: i ? 'Server' : 'Client',
      role: 'component',
      shape: 'rectangle',
      symbol: 'none',
      position: { x: 60 + i * 320, y: 70 },
      attributes: [],
      methods: [],
      ports: [],
      evidence: ['text0'],
    })),
    edges: [
      {
        id: 'request',
        source: 'client',
        target: 'server',
        label: 'request',
        relation: 'connection',
        direction: 'forward',
        sourcePort: null,
        targetPort: null,
        evidence: ['text0'],
      },
      {
        id: 'response',
        source: 'server',
        target: 'client',
        label: 'response',
        relation: 'connection',
        direction: 'forward',
        sourcePort: null,
        targetPort: null,
        evidence: ['text0'],
      },
    ],
    warnings: [],
    reviewed: false,
  };
}
export function testAnalysis(): StudyAnalysis {
  const section = {
    heading: 'Working principle',
    items: [
      {
        text: 'A client sends a request to the server and receives a response.',
        origin: 'source' as const,
        evidence: ['text0'],
      },
    ],
  };
  return {
    title: 'Client-server communication',
    category: 'network',
    summary: 'A request and response connect a client and a server.',
    topics: [{ title: 'Request and response', evidence: ['text0'] }],
    notes: { detailed: [section], short: [section], exam: [section] },
    diagrams: [testDiagram()],
    tables: [],
    flashcards: [
      { id: 'card1', front: 'Who sends the request?', back: 'The client.', evidence: ['text0'] },
    ],
    questions: [
      {
        id: 'q1',
        kind: 'mcq',
        prompt: 'Who sends the request?',
        options: ['Client', 'Server'],
        answer: 'Client',
        explanation: 'The source states that the client sends a request.',
        difficulty: 'easy',
        evidence: ['text0'],
      },
    ],
    sourceObservations: [],
    warnings: [],
  };
}
