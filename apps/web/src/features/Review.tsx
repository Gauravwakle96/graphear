import { useState } from 'react';
import { Check, Image as ImageIcon, Pencil, ShieldCheck, ZoomIn, Sparkles } from 'lucide-react';
import { analyzeGraph, type Graph } from '@graphear/core';
import { Button, Dialog } from '../components/ui';
export function Review({
  graph,
  image,
  notes,
  selectedId,
  onSelect,
  onCommit,
  onEdit,
  onAI,
}: {
  graph: Graph;
  image?: string;
  notes: string[];
  selectedId: string;
  onSelect: (id: string) => void;
  onCommit: (g: Graph) => void;
  onEdit: () => void;
  onAI?: () => void;
}) {
  const [checked, setChecked] = useState(false);
  const [inspectOpen, setInspectOpen] = useState(false);
  const [sourceZoom, setSourceZoom] = useState(1);
  const node = graph.nodes.find((n) => n.id === selectedId);
  const pending = analyzeGraph(graph).pendingReview;
  return (
    <section className="review-panel">
      <div className="panel-heading">
        <h2>Check the source</h2>
        <span className={`badge ${pending ? 'warning' : 'success'}`}>
          {pending ? `${pending} items to review` : 'Confirmed'}
        </span>
      </div>
      {notes.map((note) => (
        <p className="review-note" key={note}>
          {note}
        </p>
      ))}
      {onAI && (
        <div className="notice">
          <strong>Reconstruct the original with AI</strong>
          <p>
            Choose an accurate diagram, simplified graph or custom explanation. Review upload
            consent in Learning before any material leaves this device.
          </p>
          <Button icon={Sparkles} onClick={onAI}>
            Open AI reconstruction
          </Button>
        </div>
      )}
      {image ? (
        <>
          <div className="source-preview">
            <img
              src={image}
              alt="Original imported diagram. Its structured labels and connections are listed below."
            />
            {node?.source && (
              <svg
                className="source-box"
                viewBox={`0 0 ${graph.width} ${graph.height}`}
                aria-hidden="true"
              >
                <rect
                  x={node.source.x}
                  y={node.source.y}
                  width={node.source.width}
                  height={node.source.height}
                />
              </svg>
            )}
          </div>
          <Button
            icon={ZoomIn}
            onClick={() => {
              setSourceZoom(1);
              setInspectOpen(true);
            }}
          >
            Enlarge original source
          </Button>
        </>
      ) : (
        <div className="source-empty">
          <ImageIcon size={28} aria-hidden="true" />
          <p>
            The original image is available during its import session. Reimport it to inspect source
            pixels.
          </p>
        </div>
      )}
      <h3>Labels and step types</h3>
      <div className="review-list">
        {graph.nodes.map((n) => (
          <div className={`review-item ${n.id === selectedId ? 'active' : ''}`} key={n.id}>
            <button className="review-select" onClick={() => onSelect(n.id)}>
              <strong>{n.label}</strong>
              <span>
                {n.type} · {n.review === 'confirmed' ? 'confirmed' : 'needs review'}
              </span>
            </button>
            <Button
              variant="ghost"
              icon={Check}
              disabled={n.review === 'confirmed'}
              aria-label={`Confirm ${n.label}`}
              onClick={() =>
                onCommit({
                  ...graph,
                  nodes: graph.nodes.map((item) =>
                    item.id === n.id ? { ...item, review: 'confirmed' } : item,
                  ),
                })
              }
            >
              Confirm
            </Button>
          </div>
        ))}
      </div>
      <h3>Connections</h3>
      <ul className="review-connections">
        {graph.edges.map((edge) => (
          <li key={edge.id}>
            <span>
              {graph.nodes.find((n) => n.id === edge.source)?.label}
              <strong>{edge.label ? ` — ${edge.label} → ` : ' → '}</strong>
              {graph.nodes.find((n) => n.id === edge.target)?.label}
            </span>
            <span className={edge.review === 'confirmed' ? 'confirmed-text' : 'warning-text'}>
              {edge.review === 'confirmed' ? 'Confirmed' : 'Needs review'}
            </span>
          </li>
        ))}
      </ul>
      <Button icon={Pencil} onClick={onEdit}>
        Correct labels and connections
      </Button>
      {pending > 0 && (
        <div className="confirm-structure">
          <label className="check-field">
            <input
              type="checkbox"
              checked={checked}
              onChange={(e) => setChecked(e.target.checked)}
            />
            <span>I have checked the labels, step types and connections against the source.</span>
          </label>
          <Button
            icon={ShieldCheck}
            variant="primary"
            disabled={!checked}
            onClick={() => {
              onCommit({
                ...graph,
                nodes: graph.nodes.map((n) => ({ ...n, review: 'confirmed' })),
                edges: graph.edges.map((e) => ({ ...e, review: 'confirmed' })),
              });
              setChecked(false);
            }}
          >
            Confirm reviewed structure
          </Button>
        </div>
      )}
      {image && (
        <Dialog
          open={inspectOpen}
          title="Inspect original source"
          className="source-dialog"
          onClose={() => setInspectOpen(false)}
        >
          <p>
            Enlarge the original diagram, then scroll the image area to inspect labels and arrows.
            The image stays on this device.
          </p>
          <label className="field" htmlFor="source-zoom">
            Source zoom: {Math.round(sourceZoom * 100)}%
            <input
              id="source-zoom"
              type="range"
              min="1"
              max="3"
              step="0.25"
              value={sourceZoom}
              onChange={(e) => setSourceZoom(Number(e.target.value))}
            />
          </label>
          <div
            className="source-inspector"
            tabIndex={0}
            role="region"
            aria-label="Enlarged source diagram. Use arrow keys to scroll."
          >
            <div
              className="source-preview"
              style={{
                width: `${sourceZoom * 100}%`,
                minWidth: `${Math.min(graph.width, 900) * sourceZoom}px`,
              }}
            >
              <img
                src={image}
                alt="Enlarged original diagram for visual source review. Structured labels are available in the review list."
              />
              {node?.source && (
                <svg
                  className="source-box"
                  viewBox={`0 0 ${graph.width} ${graph.height}`}
                  aria-hidden="true"
                >
                  <rect
                    x={node.source.x}
                    y={node.source.y}
                    width={node.source.width}
                    height={node.source.height}
                  />
                </svg>
              )}
            </div>
          </div>
        </Dialog>
      )}
    </section>
  );
}
