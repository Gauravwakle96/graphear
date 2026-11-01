import { GitCompareArrows, ArrowRight, Flag, BookmarkPlus } from 'lucide-react';
import { diffGraphs, type Graph } from '@graphear/core';
import { Button } from '../components/ui';
export function Compare({
  before,
  after,
  onBaseline,
  onImport,
}: {
  before: Graph;
  after: Graph;
  onBaseline: () => void;
  onImport: () => void;
}) {
  const diff = diffGraphs(before, after);
  const changes =
    diff.changedEdges.length +
    diff.addedEdges.length +
    diff.removedEdges.length +
    diff.changedNodes.length +
    diff.addedNodes.length +
    diff.removedNodes.length;
  const label = (g: Graph, id: string) => g.nodes.find((n) => n.id === id)?.label ?? id;
  return (
    <aside className="compare-panel">
      <h2>What changed?</h2>
      <p className="panel-intro">
        Compare this diagram with the version you opened. Changes describe graph structure and
        reachable paths.
      </p>
      <div className="comparison-reference">
        <span>Baseline</span>
        <strong>{before.title}</strong>
        <span>
          {before.nodes.length} steps · {before.edges.length} connections
        </span>
      </div>
      {changes === 0 ? (
        <div className="comparison-empty">
          <GitCompareArrows size={35} aria-hidden="true" />
          <h3>The versions match</h3>
          <p>Edit a connection, then return here to explore the difference.</p>
        </div>
      ) : (
        <>
          <h3>
            {changes} structural {changes === 1 ? 'change' : 'changes'}
          </h3>
          <ul className="changes-list">
            {diff.changedEdges.map(({ before: b, after: a }) => (
              <li key={a.id}>
                <strong>Connection changed</strong>
                <span>
                  {label(before, b.source)} → {label(before, b.target)} {b.label && `(${b.label})`}
                </span>
                <ArrowRight size={16} aria-hidden="true" />
                <span>
                  {label(after, a.source)} → {label(after, a.target)} {a.label && `(${a.label})`}
                </span>
              </li>
            ))}
            {diff.addedEdges.map((e) => (
              <li key={e.id}>
                <strong>Connection added</strong>
                <span>
                  {label(after, e.source)} → {label(after, e.target)} {e.label && `(${e.label})`}
                </span>
              </li>
            ))}
            {diff.removedEdges.map((e) => (
              <li key={e.id}>
                <strong>Connection removed</strong>
                <span>
                  {label(before, e.source)} → {label(before, e.target)}
                </span>
              </li>
            ))}
            {diff.changedNodes.map((id) => (
              <li key={id}>
                <strong>Step changed</strong>
                <span>
                  {label(before, id)} → {label(after, id)}
                </span>
              </li>
            ))}
            {diff.addedNodes.map((id) => (
              <li key={id}>
                <strong>Step added</strong>
                <span>{label(after, id)}</span>
              </li>
            ))}
            {diff.removedNodes.map((id) => (
              <li key={id}>
                <strong>Step removed</strong>
                <span>{label(before, id)}</span>
              </li>
            ))}
          </ul>
          <section className="outcome-differences">
            <h3>
              <Flag size={17} aria-hidden="true" /> Outcomes from the starting step
            </h3>
            {diff.lostOutcomes.map((id) => (
              <p className="warning-text" key={id}>
                {label(before, id)} is no longer reachable.
              </p>
            ))}
            {diff.gainedOutcomes.map((id) => (
              <p className="confirmed-text" key={id}>
                {label(after, id)} is now reachable.
              </p>
            ))}
            {!diff.lostOutcomes.length && !diff.gainedOutcomes.length && (
              <p>The reachable outcomes are unchanged.</p>
            )}
          </section>
        </>
      )}
      <div className="compare-actions">
        <Button icon={BookmarkPlus} onClick={onBaseline}>
          Use current as baseline
        </Button>
        <Button variant="ghost" onClick={onImport}>
          Import a baseline JSON/SVG
        </Button>
      </div>
      <p className="fine-print">
        Matching uses stable node and connection IDs. Independently authored files may appear as
        added/removed items.
      </p>
    </aside>
  );
}
