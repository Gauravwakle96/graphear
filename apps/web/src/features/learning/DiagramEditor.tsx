import { useEffect, useMemo, useState } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  Handle,
  Position,
  type NodeProps,
  type Node,
  type Edge,
  MarkerType,
  useReactFlow,
  useNodesInitialized,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import {
  circuitSymbol,
  diagramPositions,
  studyMermaid,
  studySvg,
  type StudyDiagram,
  type Source,
} from '@graphear/core';
import DOMPurify from 'dompurify';
import { Button } from '../../components/ui';
import { download } from '../../lib/storage';
import { Citations } from './StudyViews';
type DiagramNode = Node<
  { label: string; symbol: string; role: string; attributes: string[]; methods: string[] },
  'study'
>;
function StudyNode({ data }: NodeProps<DiagramNode>) {
  return (
    <div className={`study-flow-node role-${data.role}`}>
      <Handle type="target" position={Position.Top} />
      <strong>{data.label}</strong>
      {data.symbol !== 'none' && (
        <svg viewBox="0 0 120 70" width="110" height="60" aria-label={data.symbol}>
          <g
            stroke="currentColor"
            strokeWidth="2"
            dangerouslySetInnerHTML={{ __html: circuitSymbol(data.symbol, 60, 35) }}
          />
        </svg>
      )}
      {data.attributes.length > 0 && (
        <ul>
          {data.attributes.map((a, i) => (
            <li key={i}>{a}</li>
          ))}
        </ul>
      )}
      {data.methods.length > 0 && (
        <ul>
          {data.methods.map((a, i) => (
            <li key={i}>{a}</li>
          ))}
        </ul>
      )}
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}
const nodeTypes = { study: StudyNode };
function DiagramViewControls({ selected }: { selected: string }) {
  const { fitView } = useReactFlow();
  return (
    <div className="study-canvas-actions">
      <Button
        onClick={() =>
          void fitView({ nodes: [{ id: selected }], padding: 0.4, minZoom: 0.7, maxZoom: 1.1 })
        }
      >
        Focus selected component
      </Button>
      <Button onClick={() => void fitView({ padding: 0.2, minZoom: 0.15, maxZoom: 1.1 })}>
        Fit whole diagram
      </Button>
    </div>
  );
}
function FitDiagram({ revision }: { revision: string }) {
  const { fitView } = useReactFlow();
  const initialized = useNodesInitialized();
  useEffect(() => {
    if (!initialized) return;
    const frame = requestAnimationFrame(() => {
      void fitView({ padding: 0.2, minZoom: 0.05, maxZoom: 1.1 });
    });
    return () => cancelAnimationFrame(frame);
  }, [initialized, revision, fitView]);
  return null;
}
function Notation({ diagram }: { diagram: StudyDiagram }) {
  const [markup, setMarkup] = useState(''),
    [error, setError] = useState('');
  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        await document.fonts.load('16px Manrope');
        const text = studyMermaid(diagram);
        let svg = studySvg(diagram);
        if (text) {
          const { default: mermaid } = await import('mermaid');
          mermaid.initialize({
            startOnLoad: false,
            securityLevel: 'strict',
            theme: 'base',
            htmlLabels: false,
            themeVariables: {
              primaryColor: '#edf3e8',
              primaryTextColor: '#203b32',
              primaryBorderColor: '#52665a',
              lineColor: '#52665a',
              fontFamily: 'Manrope',
            },
            flowchart: { htmlLabels: false },
            suppressErrorRendering: true,
          });
          svg = (await mermaid.render('study-' + crypto.randomUUID(), text)).svg;
        }
        const safe = DOMPurify.sanitize(svg, {
          USE_PROFILES: { svg: true, svgFilters: true },
          FORBID_TAGS: ['foreignObject', 'script', 'a', 'image'],
          FORBID_ATTR: ['href', 'xlink:href'],
        });
        const svgDocument = new DOMParser().parseFromString(safe, 'image/svg+xml');
        const root = svgDocument.documentElement,
          box = root.getAttribute('viewBox')?.split(/[ ,]+/).map(Number);
        if (box?.length === 4 && box.every(Number.isFinite)) {
          root.setAttribute('width', String(box[2]));
          root.setAttribute('height', String(box[3]));
        }
        root.querySelectorAll('text').forEach((element) => {
          element.style.fontFamily = 'Manrope, sans-serif';
        });
        if (alive) setMarkup(new XMLSerializer().serializeToString(root));
      } catch {
        if (alive)
          setError(
            'Notation could not be rendered. Use the interactive diagram and structure list.',
          );
      }
    })();
    return () => {
      alive = false;
    };
  }, [diagram]);
  return error ? (
    <p role="alert">{error}</p>
  ) : markup ? (
    <div
      className="study-notation"
      role="img"
      aria-label={diagram.description}
      dangerouslySetInnerHTML={{ __html: markup }}
    />
  ) : (
    <p role="status">Rendering notation…</p>
  );
}
export async function diagramPng(d: StudyDiagram) {
  const svg = studySvg(d),
    url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    const canvas = document.createElement('canvas');
    const factor = Math.min(1, 4096 / Math.max(image.naturalWidth, image.naturalHeight));
    canvas.width = Math.round(image.naturalWidth * factor);
    canvas.height = Math.round(image.naturalHeight * factor);
    canvas.getContext('2d')!.drawImage(image, 0, 0, canvas.width, canvas.height);
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('PNG export failed'))), 'image/png'),
    );
  } finally {
    URL.revokeObjectURL(url);
  }
}
export function DiagramEditor({
  diagram,
  onChange,
  onSource,
  disabled,
  sources,
}: {
  diagram: StudyDiagram;
  onChange: (d: StudyDiagram) => void;
  onSource: (id: string) => void;
  disabled: boolean;
  sources: Source[];
}) {
  const [mode, setMode] = useState<'interactive' | 'notation'>('interactive'),
    [selected, setSelected] = useState(diagram.nodes[0].id),
    [error, setError] = useState(''),
    [layoutBusy, setLayoutBusy] = useState(false);
  const positioned = useMemo(() => diagramPositions(diagram), [diagram]);
  const nodes: DiagramNode[] = positioned.nodes.map((n) => ({
    id: n.id,
    type: 'study',
    position: n.position!,
    data: {
      label: n.label,
      symbol: diagram.kind === 'circuit' ? n.symbol : 'none',
      role: n.role,
      attributes: n.attributes.map((a) => (a.key ? 'PK ' : '') + a.name + ': ' + a.type),
      methods: n.methods,
    },
    selected: n.id === selected,
    draggable: !disabled,
    connectable: false,
  }));
  const edges: Edge[] = diagram.edges.map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    label: e.label,
    type: 'smoothstep',
    markerEnd: e.direction !== 'none' ? { type: MarkerType.ArrowClosed } : undefined,
    markerStart: e.direction === 'both' ? { type: MarkerType.ArrowClosed } : undefined,
    style: { stroke: 'var(--muted)' },
  }));
  const node = diagram.nodes.find((n) => n.id === selected) ?? diagram.nodes[0];
  const [selectedEdge, setSelectedEdge] = useState('');
  const edge = diagram.edges.find((e) => e.id === selectedEdge) ?? diagram.edges[0];
  const updateEdge = (data: Partial<StudyDiagram['edges'][number]>) =>
    onChange({
      ...positioned,
      reviewed: false,
      edges: positioned.edges.map((e) => (e.id === edge.id ? { ...e, ...data } : e)),
    });
  const update = (data: Partial<typeof node>) =>
    onChange({
      ...positioned,
      reviewed: false,
      nodes: positioned.nodes.map((n) => (n.id === node.id ? { ...n, ...data } : n)),
    });
  async function layout() {
    setLayoutBusy(true);
    setError('');
    try {
      const { default: ELK } = await import('elkjs/lib/elk.bundled.js');
      const result = await new ELK().layout({
        id: 'root',
        layoutOptions: {
          'elk.algorithm': 'layered',
          'elk.direction': 'DOWN',
          'elk.spacing.nodeNode': '90',
          'elk.layered.spacing.nodeNodeBetweenLayers': '100',
        },
        children: diagram.nodes.map((n) => ({
          id: n.id,
          width: 230,
          height: Math.max(140, 60 + (n.attributes.length + n.methods.length) * 24),
        })),
        edges: diagram.edges
          .filter((e) => e.source !== e.target)
          .map((e) => ({ id: e.id, sources: [e.source], targets: [e.target] })),
      });
      onChange({
        ...diagram,
        reviewed: false,
        nodes: diagram.nodes.map((n) => ({
          ...n,
          position: {
            x: Math.min(4096, result.children!.find((c) => c.id === n.id)!.x ?? 0),
            y: Math.min(4096, result.children!.find((c) => c.id === n.id)!.y ?? 0),
          },
        })),
      });
    } catch {
      setError('Layout could not be calculated. You can move nodes manually.');
    } finally {
      setLayoutBusy(false);
    }
  }
  return (
    <div className="study-diagram-editor">
      <div className="study-diagram-heading">
        <div>
          <h2>{diagram.title}</h2>
          <p>
            {diagram.kind} · {diagram.nodes.length} components · {diagram.edges.length}{' '}
            relationships
          </p>
        </div>
        <span className={`badge ${diagram.reviewed ? 'success' : 'warning'}`}>
          {diagram.reviewed ? 'Source reviewed' : 'Draft — review source'}
        </span>
      </div>
      <p>{diagram.description}</p>
      {diagram.kind === 'scientific' && (
        <p className="notice">
          This is an editable scientific schematic. Check biological structures and spatial
          relationships against the source.
        </p>
      )}
      {diagram.warnings.length > 0 && (
        <ul className="study-warnings">
          {diagram.warnings.map((w, i) => (
            <li key={i}>{w}</li>
          ))}
        </ul>
      )}
      <div className="study-toolbar">
        <div className="mode-switch" role="group" aria-label="Diagram view">
          <Button aria-pressed={mode === 'interactive'} onClick={() => setMode('interactive')}>
            Interactive
          </Button>
          <Button aria-pressed={mode === 'notation'} onClick={() => setMode('notation')}>
            Notation
          </Button>
        </div>
        <Button disabled={disabled || layoutBusy} onClick={() => void layout()}>
          {layoutBusy ? 'Arranging…' : 'Arrange nodes'}
        </Button>
        <Button onClick={() => download('diagram.svg', studySvg(positioned), 'image/svg+xml')}>
          SVG
        </Button>
        <Button
          onClick={() =>
            void diagramPng(positioned)
              .then((b) => download('diagram.png', b))
              .catch((e) => setError(e.message))
          }
        >
          PNG
        </Button>
      </div>
      {error && (
        <p role="alert" className="error-text">
          {error}
        </p>
      )}
      {mode === 'interactive' ? (
        <div className="study-flow" aria-label="Interactive diagram">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            onNodeClick={(_, n) => setSelected(n.id)}
            onNodeDragStop={(_, n) =>
              onChange({
                ...positioned,
                reviewed: false,
                nodes: positioned.nodes.map((v) =>
                  v.id === n.id
                    ? {
                        ...v,
                        position: {
                          x: Math.max(0, Math.min(4096, n.position.x)),
                          y: Math.max(0, Math.min(4096, n.position.y)),
                        },
                      }
                    : v,
                ),
              })
            }
            fitView
            nodesConnectable={false}
            edgesReconnectable={false}
            minZoom={0.15}
            maxZoom={2}
            proOptions={{ hideAttribution: true }}
          >
            <FitDiagram
              revision={JSON.stringify(
                positioned.nodes.map((n) => [n.id, n.label, n.position, n.attributes, n.methods]),
              )}
            />
            <Background />
            <DiagramViewControls selected={selected} />
            <Controls showInteractive={false} />
          </ReactFlow>
        </div>
      ) : (
        <Notation diagram={positioned} />
      )}
      <details className="study-structure" open>
        <summary>Keyboard editor and complete diagram structure</summary>
        <div className="study-node-controls">
          <label>
            Component
            <select value={node.id} onChange={(e) => setSelected(e.target.value)}>
              {diagram.nodes.map((n) => (
                <option key={n.id} value={n.id}>
                  {n.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Label
            <input
              value={node.label}
              maxLength={250}
              disabled={disabled}
              onChange={(e) => update({ label: e.target.value || 'Untitled' })}
            />
          </label>
          <label>
            Horizontal position
            <input
              type="number"
              min={0}
              max={4096}
              value={positioned.nodes.find((n) => n.id === node.id)!.position!.x}
              disabled={disabled}
              onChange={(e) =>
                update({
                  position: {
                    ...positioned.nodes.find((n) => n.id === node.id)!.position!,
                    x: Math.max(0, Math.min(4096, Number(e.target.value))),
                  },
                })
              }
            />
          </label>
          <label>
            Vertical position
            <input
              type="number"
              min={0}
              max={4096}
              value={positioned.nodes.find((n) => n.id === node.id)!.position!.y}
              disabled={disabled}
              onChange={(e) =>
                update({
                  position: {
                    ...positioned.nodes.find((n) => n.id === node.id)!.position!,
                    y: Math.max(0, Math.min(4096, Number(e.target.value))),
                  },
                })
              }
            />
          </label>
        </div>
        {edge && (
          <fieldset className="study-question">
            <legend>Edit relationships</legend>
            <div className="study-node-controls">
              <label>
                Relationship
                <select value={edge.id} onChange={(e) => setSelectedEdge(e.target.value)}>
                  {diagram.edges.map((e) => (
                    <option key={e.id} value={e.id}>
                      {diagram.nodes.find((n) => n.id === e.source)!.label} to{' '}
                      {diagram.nodes.find((n) => n.id === e.target)!.label}: {e.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Connection label
                <input
                  value={edge.label}
                  maxLength={200}
                  disabled={disabled}
                  onChange={(e) => updateEdge({ label: e.target.value })}
                />
              </label>
              <label>
                From component
                <select
                  value={edge.source}
                  disabled={disabled}
                  onChange={(e) => updateEdge({ source: e.target.value, sourcePort: null })}
                >
                  {diagram.nodes.map((n) => (
                    <option key={n.id} value={n.id}>
                      {n.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                To component
                <select
                  value={edge.target}
                  disabled={disabled}
                  onChange={(e) => updateEdge({ target: e.target.value, targetPort: null })}
                >
                  {diagram.nodes.map((n) => (
                    <option key={n.id} value={n.id}>
                      {n.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Direction
                <select
                  value={edge.direction}
                  disabled={disabled}
                  onChange={(e) =>
                    updateEdge({ direction: e.target.value as typeof edge.direction })
                  }
                >
                  <option value="forward">Forward</option>
                  <option value="both">Both directions</option>
                  <option value="none">Undirected</option>
                </select>
              </label>
              <label>
                Relationship type
                <select
                  value={edge.relation}
                  disabled={disabled}
                  onChange={(e) => updateEdge({ relation: e.target.value as typeof edge.relation })}
                >
                  {[
                    'flow',
                    'connection',
                    'message',
                    'association',
                    'dependency',
                    'contains',
                    'is-a',
                    'electrical',
                  ].map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </fieldset>
        )}
        <p>
          {node.role}
          {node.symbol !== 'none' ? ' · ' + node.symbol : ''}
          {node.ports.length ? ' · Ports: ' + node.ports.join(', ') : ''}
        </p>
        <div className="study-citations">
          {node.evidence.map((id) => (
            <Button key={id} onClick={() => onSource(id)}>
              {sources.find((s) => s.id === id)?.reference ?? 'Original source'}
            </Button>
          ))}
        </div>
        <ul>
          {diagram.edges.map((e) => (
            <li key={e.id}>
              {diagram.nodes.find((n) => n.id === e.source)!.label}{' '}
              {e.direction === 'both' ? '↔' : e.direction === 'none' ? '—' : '→'}{' '}
              {diagram.nodes.find((n) => n.id === e.target)!.label}
              {e.label ? ' · ' + e.label : ''} ({e.relation}
              {e.sourcePort ? '; ' + e.sourcePort + ' to ' + e.targetPort : ''})
              <Citations ids={e.evidence} sources={sources} onSource={onSource} />
            </li>
          ))}
        </ul>
      </details>
      <label className="study-consent">
        <input
          type="checkbox"
          checked={diagram.reviewed}
          disabled={disabled}
          onChange={(e) => onChange({ ...positioned, reviewed: e.target.checked })}
        />
        I checked these components and connections against the original source.
      </label>
    </div>
  );
}
