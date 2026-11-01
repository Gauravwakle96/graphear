import { graphText, createQuestions, type Graph } from '@graphear/core';
const escape = (text: string) =>
  text.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );
export function learningPack(graph: Graph) {
  const questions = createQuestions(graph);
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(graph.title)} — Graphear learning pack</title><style>body{font:18px/1.7 system-ui;max-width:72ch;margin:3rem auto;padding:0 1.5rem;color:#173e32;background:#fff}h1,h2{line-height:1.2}pre{white-space:pre-wrap;font:inherit}details{margin:1rem 0;padding:1rem;border:1px solid #879c90}summary{cursor:pointer}a{color:#174db8}button{font:inherit}</style></head><body><main><h1>${escape(graph.title)}</h1><p>Portable learning pack created with Graphear. Diagram facts come from the included graph. Review status is supplied by its author.</p><pre>${escape(graphText(graph))}</pre><h2>Practice</h2>${questions.map((q) => `<details><summary>${escape(q.prompt)}</summary><p>${escape(q.explanation)}</p></details>`).join('')}<h2>Graph data</h2><details><summary>View the portable JSON graph</summary><pre>${escape(JSON.stringify(graph, null, 2))}</pre></details></main></body></html>`;
}
