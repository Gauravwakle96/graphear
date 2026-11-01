import { useId } from 'react';
import { GitBranch, Flag, Play, Square, Check } from 'lucide-react';
import { type Graph, type GraphNode } from '@graphear/core';
type Props = {
  graph: Graph;
  selectedId: string;
  path: string[];
  onSelect: (id: string) => void;
  changedEdges?: Set<string>;
  hidden?: boolean;
};
function connection(a: GraphNode, b: GraphNode) {
  const ac = { x: a.x + a.width / 2, y: a.y + a.height / 2 },
    bc = { x: b.x + b.width / 2, y: b.y + b.height / 2 };
  const vertical = Math.abs(bc.y - ac.y) > Math.abs(bc.x - ac.x) * 0.6;
  const start = vertical
    ? { x: ac.x, y: bc.y >= ac.y ? a.y + a.height : a.y }
    : { x: bc.x >= ac.x ? a.x + a.width : a.x, y: ac.y };
  const end = vertical
    ? { x: bc.x, y: bc.y >= ac.y ? b.y : b.y + b.height }
    : { x: bc.x >= ac.x ? b.x : b.x + b.width, y: bc.y };
  const mid = { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 };
  const d = vertical
    ? `M${start.x},${start.y} C${start.x},${mid.y} ${end.x},${mid.y} ${end.x},${end.y}`
    : `M${start.x},${start.y} C${mid.x},${start.y} ${mid.x},${end.y} ${end.x},${end.y}`;
  return { d, mid };
}
const typeIcons = { start: Play, process: Square, decision: GitBranch, end: Flag };
export function GraphCanvas({
  graph,
  selectedId,
  path,
  onSelect,
  changedEdges = new Set(),
  hidden = false,
}: Props) {
  const marker = useId().replace(/:/g, '');
  const nodeMap = new Map(graph.nodes.map((n) => [n.id, n]));
  return (
    <div className={`canvas-scroll ${hidden ? 'canvas-hidden' : ''}`}>
      <div
        className="graph-canvas"
        style={{ aspectRatio: `${graph.width}/${graph.height}` }}
        aria-label="Interactive flowchart"
      >
        <svg
          className="graph-lines"
          viewBox={`0 0 ${graph.width} ${graph.height}`}
          aria-hidden="true"
        >
          <defs>
            <marker id={marker} markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
              <path d="M0,0 L8,4 L0,8 Z" fill="context-stroke" />
            </marker>
          </defs>
          {graph.edges.map((edge) => {
            const a = nodeMap.get(edge.source),
              b = nodeMap.get(edge.target);
            if (!a || !b) return null;
            const { d } = connection(a, b);
            const traversed = path.some(
              (id, i) => id === edge.source && path[i + 1] === edge.target,
            );
            return (
              <g
                key={edge.id}
                className={`graph-edge ${traversed ? 'traversed' : ''} ${changedEdges.has(edge.id) ? 'changed' : ''} ${edge.review !== 'confirmed' ? 'unconfirmed' : ''}`}
              >
                <path d={d} markerEnd={`url(#${marker})`} />
              </g>
            );
          })}
        </svg>
        {graph.edges
          .filter((edge) => edge.label)
          .map((edge) => {
            const a = nodeMap.get(edge.source),
              b = nodeMap.get(edge.target);
            if (!a || !b) return null;
            const { mid } = connection(a, b);
            return (
              <span
                key={edge.id}
                className="edge-label"
                aria-hidden="true"
                title={edge.label}
                style={{
                  left: `${(mid.x / graph.width) * 100}%`,
                  top: `${(mid.y / graph.height) * 100}%`,
                }}
              >
                {edge.label.length > 10 ? edge.label.slice(0, 9) + '…' : edge.label}
              </span>
            );
          })}
        {graph.nodes.map((node) => {
          const Icon = typeIcons[node.type];
          const visited = path.includes(node.id) && node.id !== selectedId;
          return (
            <button
              key={node.id}
              className={`graph-node ${node.type} ${node.id === selectedId ? 'selected' : ''} ${visited ? 'visited' : ''} ${node.review !== 'confirmed' ? 'unconfirmed' : ''}`}
              style={{
                left: `${(node.x / graph.width) * 100}%`,
                top: `${(node.y / graph.height) * 100}%`,
                width: `${(node.width / graph.width) * 100}%`,
                height: `${(node.height / graph.height) * 100}%`,
              }}
              aria-pressed={node.id === selectedId}
              aria-label={`${node.label}, ${node.type}${node.review !== 'confirmed' ? ', needs review' : ''}`}
              onClick={() => onSelect(node.id)}
            >
              <Icon size={15} aria-hidden="true" />
              <span>{node.label}</span>
              {visited && <Check size={13} aria-hidden="true" />}
            </button>
          );
        })}
      </div>
      {hidden && (
        <div className="canvas-cover">
          <h2 className="cover-title">Focus on the structure</h2>
          <p>
            The visual diagram is hidden. Explore using the step controls and branch descriptions.
          </p>
        </div>
      )}
    </div>
  );
}
