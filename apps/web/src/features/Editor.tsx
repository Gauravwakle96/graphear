import { useState } from 'react';
import {
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  Check,
  Link2,
} from 'lucide-react';
import { parseGraph, type Graph, type GraphEdge, type GraphNode } from '@graphear/core';
import { Button, IconButton } from '../components/ui';
function EdgeEditor({
  edge,
  graph,
  onCommit,
}: {
  edge: GraphEdge;
  graph: Graph;
  onCommit: (graph: Graph) => void;
}) {
  const [target, setTarget] = useState(edge.target),
    [label, setLabel] = useState(edge.label);
  return (
    <form
      className="connection-row"
      onSubmit={(e) => {
        e.preventDefault();
        onCommit({
          ...graph,
          edges: graph.edges.map((item) =>
            item.id === edge.id
              ? { ...edge, target, label: label.trim(), review: 'confirmed' }
              : item,
          ),
        });
      }}
    >
      <label className="field">
        Next step
        <select value={target} onChange={(e) => setTarget(e.target.value)}>
          {graph.nodes.map((n) => (
            <option key={n.id} value={n.id}>
              {n.label}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        Branch label
        <input
          maxLength={100}
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="For example, Yes"
        />
      </label>
      <div className="row-actions">
        <Button type="submit" icon={Check}>
          Apply
        </Button>
        <IconButton
          icon={Trash2}
          label={`Remove connection ${edge.label || 'to ' + graph.nodes.find((n) => n.id === edge.target)?.label}`}
          type="button"
          onClick={() =>
            onCommit({ ...graph, edges: graph.edges.filter((item) => item.id !== edge.id) })
          }
        />
      </div>
    </form>
  );
}
export function Editor({
  graph,
  selectedId,
  onCommit,
  onSelect,
}: {
  graph: Graph;
  selectedId: string;
  onCommit: (graph: Graph) => void;
  onSelect: (id: string) => void;
}) {
  const node = graph.nodes.find((n) => n.id === selectedId) ?? graph.nodes[0];
  const [label, setLabel] = useState(node.label),
    [type, setType] = useState(node.type),
    [newLabel, setNewLabel] = useState(''),
    [newType, setNewType] = useState<GraphNode['type']>('process'),
    [target, setTarget] = useState(graph.nodes.find((n) => n.id !== node.id)?.id ?? node.id),
    [branch, setBranch] = useState(''),
    [error, setError] = useState('');
  const apply = (next: Graph) => {
    try {
      onCommit(parseGraph(next));
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The edit could not be applied.');
    }
  };
  const move = (dx: number, dy: number) =>
    apply({
      ...graph,
      nodes: graph.nodes.map((n) =>
        n.id === node.id
          ? {
              ...n,
              x: Math.max(0, Math.min(graph.width - n.width, n.x + dx)),
              y: Math.max(0, Math.min(graph.height - n.height, n.y + dy)),
            }
          : n,
      ),
    });
  return (
    <aside className="editor-panel" aria-label="Diagram editing controls">
      <h2>Edit the structure</h2>
      <p className="panel-intro">Every edit can be undone. Choose a step on the canvas or below.</p>
      <label className="field">
        Selected step
        <select value={node.id} onChange={(e) => onSelect(e.target.value)}>
          {graph.nodes.map((n) => (
            <option key={n.id} value={n.id}>
              {n.label}
            </option>
          ))}
        </select>
      </label>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!label.trim()) {
            setError('Give this step a label.');
            return;
          }
          apply({
            ...graph,
            nodes: graph.nodes.map((n) =>
              n.id === node.id ? { ...n, label: label.trim(), type, review: 'confirmed' } : n,
            ),
          });
        }}
      >
        <label className="field">
          Step label
          <input
            value={label}
            maxLength={250}
            onChange={(e) => setLabel(e.target.value)}
            required
          />
        </label>
        <label className="field">
          Step type
          <select value={type} onChange={(e) => setType(e.target.value as GraphNode['type'])}>
            <option value="start">Start</option>
            <option value="process">Process</option>
            <option value="decision">Decision</option>
            <option value="end">Outcome</option>
          </select>
        </label>
        <Button variant="primary" icon={Check} type="submit">
          Apply step changes
        </Button>
      </form>
      <div className="move-controls">
        <span>Move step</span>
        <IconButton icon={ArrowLeft} label="Move step left" onClick={() => move(-25, 0)} />
        <IconButton icon={ArrowUp} label="Move step up" onClick={() => move(0, -25)} />
        <IconButton icon={ArrowDown} label="Move step down" onClick={() => move(0, 25)} />
        <IconButton icon={ArrowRight} label="Move step right" onClick={() => move(25, 0)} />
      </div>
      <Button
        variant="ghost"
        icon={Trash2}
        disabled={graph.nodes.length === 1}
        onClick={() => {
          const next = {
            ...graph,
            nodes: graph.nodes.filter((n) => n.id !== node.id),
            edges: graph.edges.filter((e) => e.source !== node.id && e.target !== node.id),
          };
          apply(next);
          onSelect(next.nodes[0].id);
        }}
      >
        Remove this step
      </Button>
      <section className="editor-section">
        <h3>
          <Link2 size={17} aria-hidden="true" /> Outgoing connections
        </h3>
        {graph.edges
          .filter((e) => e.source === node.id)
          .map((edge) => (
            <EdgeEditor
              key={`${edge.id}-${edge.target}-${edge.label}`}
              edge={edge}
              graph={graph}
              onCommit={apply}
            />
          ))}
        <form
          className="new-connection"
          onSubmit={(e) => {
            e.preventDefault();
            if (
              graph.edges.some(
                (item) =>
                  item.source === node.id && item.target === target && item.label === branch.trim(),
              )
            ) {
              setError('This connection already exists.');
              return;
            }
            apply({
              ...graph,
              edges: [
                ...graph.edges,
                {
                  id: crypto.randomUUID(),
                  source: node.id,
                  target,
                  label: branch.trim(),
                  review: 'confirmed',
                },
              ],
            });
            setBranch('');
          }}
        >
          <label className="field">
            Connect to
            <select value={target} onChange={(e) => setTarget(e.target.value)}>
              {graph.nodes.map((n) => (
                <option key={n.id} value={n.id}>
                  {n.label}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            Connection label
            <input
              value={branch}
              maxLength={100}
              onChange={(e) => setBranch(e.target.value)}
              placeholder="Yes, No, Complete…"
            />
          </label>
          <Button icon={Plus} type="submit">
            Add connection
          </Button>
        </form>
      </section>
      <section className="editor-section">
        <h3>Add a step</h3>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!newLabel.trim()) return;
            const id = crypto.randomUUID();
            const bottom = Math.max(...graph.nodes.map((n) => n.y + n.height)) + 55;
            const height = Math.max(graph.height, bottom + 120);
            if (height > 4096) {
              setError('The diagram is full. Move steps to make room.');
              return;
            }
            apply({
              ...graph,
              height,
              nodes: [
                ...graph.nodes,
                {
                  id,
                  label: newLabel.trim(),
                  type: newType,
                  x: Math.max(0, graph.width / 2 - 100),
                  y: bottom,
                  width: 200,
                  height: newType === 'decision' ? 88 : 65,
                  review: 'confirmed',
                },
              ],
            });
            setNewLabel('');
            onSelect(id);
          }}
        >
          <label className="field">
            New step label
            <input
              value={newLabel}
              maxLength={250}
              onChange={(e) => setNewLabel(e.target.value)}
              placeholder="Describe the new step"
              required
            />
          </label>
          <label className="field">
            New step type
            <select
              value={newType}
              onChange={(e) => setNewType(e.target.value as GraphNode['type'])}
            >
              <option value="process">Process</option>
              <option value="decision">Decision</option>
              <option value="end">Outcome</option>
              <option value="start">Start</option>
            </select>
          </label>
          <Button icon={Plus} type="submit" disabled={graph.nodes.length >= 100}>
            Add step
          </Button>
        </form>
      </section>
      {error && (
        <p className="inline-error" role="alert">
          {error}
        </p>
      )}
    </aside>
  );
}
