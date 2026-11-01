import { useState, useRef, useEffect, useMemo, lazy, Suspense } from 'react';
import {
  GitBranch,
  FileText,
  FolderOpen,
  GraduationCap,
  HelpCircle,
  Upload,
  Download,
  Save,
  Sun,
  Moon,
  Plus,
  Undo2,
  Redo2,
  Eye,
  EyeOff,
  Link2,
  CheckCircle2,
  AlertTriangle,
  ZoomIn,
  ZoomOut,
  ArrowRight,
  Wrench,
  Sparkles,
  X,
} from 'lucide-react';
import {
  parseGraph,
  createBlankGraph,
  startNode,
  outgoing,
  describeNode,
  analyzeGraph,
  diffGraphs,
  graphText,
  graphSummary,
  repairGraph,
  checkRepair,
  scholarshipGraph,
  type Graph,
} from '@graphear/core';
import { Button, IconButton, Dialog } from './components/ui';
import { GraphCanvas } from './components/GraphCanvas';
import { Explorer } from './features/Explorer';
import { Editor } from './features/Editor';
import { Review } from './features/Review';
import { Compare } from './features/Compare';
import { Library } from './features/Library';
import { Practice } from './features/Practice';
import { Guide } from './features/Guide';
import { importFile, validateRasterFile, type Imported } from './lib/import';
import { ImageImportChoice } from './features/ImageImportChoice';
import { saveLocal, download, filename } from './lib/storage';
import { saveRemote, publishRemote, revokeRemote, getShared } from './lib/api';
import { learningPack } from './lib/export';
import { graphSvg } from './lib/svg';

const Learning = lazy(() => import('./features/Learning').then((m) => ({ default: m.Learning })));

type Saved = {
  storage: 'device' | 'workspace';
  id: string;
  revision?: number;
  shareToken?: string;
};
type Mode = 'explore' | 'edit' | 'review' | 'compare';
const pageFromHash = () => window.location.hash.slice(1) || 'workspace';
function initialTheme() {
  try {
    return (
      localStorage.getItem('graphear-theme') ??
      (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    );
  } catch {
    return 'light';
  }
}
export default function App() {
  const [page, setPage] = useState(pageFromHash),
    [graph, setGraph] = useState<Graph>(() => structuredClone(scholarshipGraph)),
    [baseline, setBaseline] = useState<Graph>(() => structuredClone(scholarshipGraph)),
    [selectedId, setSelected] = useState('start'),
    [path, setPath] = useState(['start']),
    [mode, setMode] = useState<Mode>('explore'),
    [undo, setUndo] = useState<Graph[]>([]),
    [redo, setRedo] = useState<Graph[]>([]),
    [dirty, setDirty] = useState(false),
    [learningDirty, setLearningDirty] = useState(false),
    [leaveLearning, setLeaveLearning] = useState<string | null>(null),
    [saved, setSaved] = useState<Saved | undefined>(),
    [image, setImage] = useState<string | undefined>('/examples/scholarship.svg'),
    [aiSource, setAISource] = useState<File | null>(null),
    [pendingImage, setPendingImage] = useState<File | null>(null),
    [assistantOpen, setAssistantOpen] = useState(false),
    [notes, setNotes] = useState<string[]>([]),
    [theme, setTheme] = useState(initialTheme),
    [hidden, setHidden] = useState(false),
    [zoom, setZoom] = useState(1),
    [message, setMessage] = useState(''),
    [importing, setImporting] = useState(false),
    [progress, setProgress] = useState({ text: '', value: 0 }),
    [saveOpen, setSaveOpen] = useState(false),
    [saveName, setSaveName] = useState(graph.title),
    [saveWhere, setSaveWhere] = useState<'device' | 'workspace'>('device'),
    [copy, setCopy] = useState(false),
    [saving, setSaving] = useState(false),
    [saveError, setSaveError] = useState(''),
    [shareOpen, setShareOpen] = useState(false),
    [shareUrl, setShareUrl] = useState(''),
    [shareError, setShareError] = useState(''),
    [sharing, setSharing] = useState(false),
    [mission, setMission] = useState(false),
    [missionFeedback, setMissionFeedback] = useState(''),
    [discard, setDiscard] = useState<(() => void) | null>(null),
    [sharedLoading, setSharedLoading] = useState(false),
    [sharedError, setSharedError] = useState('');
  const fileInput = useRef<HTMLInputElement>(null),
    baselineInput = useRef<HTMLInputElement>(null),
    exportMenu = useRef<HTMLDetailsElement>(null),
    abort = useRef<AbortController | null>(null);
  const analysis = useMemo(() => analyzeGraph(graph), [graph]);
  const differences = useMemo(() => diffGraphs(baseline, graph), [baseline, graph]);
  const readonly = page.startsWith('share/');
  useEffect(() => {
    const update = () => {
      const next = pageFromHash();
      if (page === 'learning' && learningDirty && next !== 'learning') {
        window.history.replaceState(null, '', '#learning');
        setLeaveLearning(next);
      } else setPage(next);
    };
    window.addEventListener('hashchange', update);
    return () => window.removeEventListener('hashchange', update);
  }, [page, learningDirty]);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem('graphear-theme', theme);
    } catch {
      /* A theme preference does not require persistent storage. */
    }
  }, [theme]);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (dirty) {
        event.preventDefault();
        event.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);
  useEffect(() => {
    if (!page.startsWith('share/')) return;
    setSharedLoading(true);
    setSharedError('');
    void getShared(page.slice(6))
      .then((result) => {
        setGraph(result.graph);
        setBaseline(structuredClone(result.graph));
        const id = startNode(result.graph).id;
        setSelected(id);
        setPath([id]);
        setImage(undefined);
        setUndo([]);
        setRedo([]);
        setSaved(undefined);
        setDirty(false);
        setMode('explore');
      })
      .catch((e) =>
        setSharedError(e instanceof Error ? e.message : 'The shared diagram could not open.'),
      )
      .finally(() => setSharedLoading(false));
  }, [page]);
  const navigate = (next: string) => {
    if (page === 'learning' && learningDirty && next !== 'learning') {
      setLeaveLearning(next);
      return;
    }
    window.location.hash = next;
    setPage(next);
  };
  const structureWithAI = () => {
    if (!image || !/^data:image\/(png|jpeg|webp);base64,/.test(image)) return;
    try {
      const [header, encoded] = image.split(',');
      const mime = header.slice(5, header.indexOf(';'));
      const bytes = Uint8Array.from(atob(encoded), (c) => c.charCodeAt(0));
      setAISource(
        new File(
          [bytes],
          `${filename(graph.title)}.${mime === 'image/jpeg' ? 'jpg' : mime.split('/')[1]}`,
          { type: mime },
        ),
      );
      navigate('learning');
    } catch {
      setMessage('The source image could not be prepared. Reimport it and try again.');
    }
  };
  const select = (id: string) => {
    setSelected(id);
    setPath([id]);
  };
  const commit = (next: Graph) => {
    const valid = parseGraph(next);
    setUndo((items) => [...items, graph].slice(-30));
    setRedo([]);
    setGraph(valid);
    setDirty(true);
    setMissionFeedback('');
    if (!valid.nodes.some((n) => n.id === selectedId)) {
      setSelected(startNode(valid).id);
      setPath([startNode(valid).id]);
    } else setPath([selectedId]);
  };
  const load = (
    next: Graph,
    metadata?: Saved,
    source?: string,
    sourceNotes: string[] = [],
    nextMode: Mode = 'explore',
    isMission = false,
  ) => {
    const run = () => {
      const valid = parseGraph(next);
      setGraph(valid);
      setBaseline(isMission ? structuredClone(scholarshipGraph) : structuredClone(valid));
      const id = isMission ? 'documents' : startNode(valid).id;
      setSelected(id);
      setPath([id]);
      setUndo([]);
      setRedo([]);
      setSaved(metadata);
      setDirty(false);
      setImage(source);
      setNotes(sourceNotes);
      setMode(nextMode);
      setMission(isMission);
      setMissionFeedback('');
      setZoom(1);
      navigate('workspace');
    };
    if (dirty) setDiscard(() => run);
    else run();
  };
  const walk = (id: string) => {
    if (!outgoing(graph, selectedId).some((e) => e.target === id)) return;
    setSelected(id);
    setPath((current) => [...current, id].slice(-100));
  };
  const undoEdit = () => {
    if (!undo.length) return;
    const previous = undo.at(-1)!;
    setRedo((items) => [...items, graph]);
    setUndo((items) => items.slice(0, -1));
    setGraph(previous);
    setDirty(true);
    setSelected(startNode(previous).id);
    setPath([startNode(previous).id]);
    setMessage('Edit undone.');
  };
  const redoEdit = () => {
    if (!redo.length) return;
    const next = redo.at(-1)!;
    setUndo((items) => [...items, graph]);
    setRedo((items) => items.slice(0, -1));
    setGraph(next);
    setDirty(true);
    setSelected(startNode(next).id);
    setPath([startNode(next).id]);
    setMessage('Edit restored.');
  };
  const handleImport = async (file: File, isBaseline = false) => {
    if (importing) return;
    if (isBaseline && !/\.(json|svg)$/i.test(file.name)) {
      setMessage('Choose JSON or SVG for a baseline.');
      return;
    }
    const controller = new AbortController();
    abort.current = controller;
    setImporting(true);
    setProgress({ text: 'Reading diagram', value: 0 });
    try {
      const result: Imported = await importFile(
        file,
        (text, value) => setProgress({ text, value }),
        controller.signal,
      );
      if (isBaseline) {
        setBaseline(result.graph);
        setMode('compare');
        setMessage('Comparison baseline imported.');
      } else {
        load(
          result.graph,
          undefined,
          result.image,
          result.notes,
          analyzeGraph(result.graph).pendingReview ? 'review' : 'explore',
        );
        setMessage('Diagram imported. Review the source before relying on its structure.');
      }
    } catch (e) {
      setMessage(
        controller.signal.aborted
          ? 'Import cancelled. Your previous diagram is still open.'
          : e instanceof Error
            ? e.message
            : 'This diagram could not be imported. Try SVG/JSON or create it manually.',
      );
    } finally {
      setImporting(false);
      abort.current = null;
      if (fileInput.current) fileInput.current.value = '';
      if (baselineInput.current) baselineInput.current.value = '';
    }
  };
  const chooseImport = async (file: File) => {
    if (importing) return;
    if (!/\.(png|jpe?g|webp)$/i.test(file.name)) return handleImport(file);
    setImporting(true);
    setProgress({ text: 'Checking original image', value: 0 });
    try {
      await validateRasterFile(file);
      setPendingImage(file);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'This image could not be read.');
    } finally {
      setImporting(false);
      if (fileInput.current) fileInput.current.value = '';
    }
  };
  const exportFile = (kind: 'json' | 'text' | 'html' | 'svg') => {
    const name = filename(graph.title);
    if (kind === 'json') download(`${name}.json`, JSON.stringify(graph, null, 2));
    if (kind === 'text') download(`${name}.txt`, graphText(graph), 'text/plain');
    if (kind === 'html') download(`${name}-learning-pack.html`, learningPack(graph), 'text/html');
    if (kind === 'svg') download(`${name}.svg`, graphSvg(graph), 'image/svg+xml');
    if (exportMenu.current) exportMenu.current.open = false;
    setMessage('Export downloaded.');
  };
  const beginSave = () => {
    setSaveName(graph.title);
    setSaveWhere(saved?.storage ?? 'device');
    setCopy(false);
    setSaveError('');
    setSaveOpen(true);
  };
  const save = async () => {
    if (!saveName.trim()) return;
    setSaving(true);
    setSaveError('');
    try {
      const next = parseGraph({ ...graph, title: saveName.trim() });
      if (saveWhere === 'device') {
        const result = await saveLocal(
          next,
          !copy && saved?.storage === 'device' ? saved.id : undefined,
        );
        setSaved({ storage: 'device', id: result.id });
      } else {
        const existing =
          !copy && saved?.storage === 'workspace'
            ? { id: saved.id, revision: saved.revision! }
            : undefined;
        const result = await saveRemote(next, existing);
        setSaved({
          storage: 'workspace',
          id: result.id,
          revision: result.revision,
          shareToken: result.shareToken,
        });
      }
      setGraph(next);
      setDirty(false);
      setSaveOpen(false);
      setMessage(
        saveWhere === 'device'
          ? 'Diagram saved on this device.'
          : 'Diagram saved to your private workspace.',
      );
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Save failed. Try a device save or export.');
    } finally {
      setSaving(false);
    }
  };
  const publish = async () => {
    setSharing(true);
    setShareError('');
    try {
      if (analysis.pendingReview) throw new Error('Confirm the diagram structure before sharing.');
      const existing =
        saved?.storage === 'workspace' ? { id: saved.id, revision: saved.revision! } : undefined;
      const record = await saveRemote(graph, existing);
      const result = await publishRemote(record.id);
      setSaved({
        storage: 'workspace',
        id: record.id,
        revision: record.revision,
        shareToken: result.token,
      });
      setShareUrl(new URL(result.url, window.location.origin).href);
      setDirty(false);
      setMessage('Read-only link created.');
    } catch (e) {
      setShareError(
        e instanceof Error ? e.message : 'Sharing is unavailable. Export a learning pack instead.',
      );
    } finally {
      setSharing(false);
    }
  };
  const changedEdges = new Set([
    ...differences.changedEdges.map((e) => e.after.id),
    ...differences.addedEdges.map((e) => e.id),
  ]);
  const nav = [
    { id: 'workspace', label: 'Workspace', icon: GitBranch },
    { id: 'learning', label: 'Learning', icon: FileText },
    { id: 'library', label: 'Library', icon: FolderOpen },
    { id: 'practice', label: 'Practice', icon: GraduationCap },
    { id: 'guide', label: 'Guide', icon: HelpCircle },
  ];
  return (
    <div className="app-shell">
      <a
        className="skip-link"
        href="#main-content"
        onClick={(e) => {
          e.preventDefault();
          document.getElementById('main-content')?.focus();
        }}
      >
        Skip to main content
      </a>
      <header className="app-header">
        <a
          href="#workspace"
          className="brand"
          onClick={(e) => {
            e.preventDefault();
            navigate('workspace');
          }}
        >
          <img src="/favicon.svg" alt="" width="33" height="33" />
          <span>Graphear</span>
        </a>
        <span className="brand-description">Explore. Repair. Understand.</span>
        <div className="header-actions">
          <IconButton
            icon={theme === 'light' ? Moon : Sun}
            label={theme === 'light' ? 'Switch to dark theme' : 'Switch to light theme'}
            onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
          />
          <Button icon={HelpCircle} variant="ghost" onClick={() => navigate('guide')}>
            Help
          </Button>
        </div>
      </header>
      <nav className="side-nav" aria-label="Main navigation">
        {nav.map(({ id, label, icon: Icon }) => (
          <a
            key={id}
            href={`#${id}`}
            className={page === id ? 'active' : ''}
            aria-current={page === id ? 'page' : undefined}
            onClick={(e) => {
              e.preventDefault();
              navigate(id);
            }}
          >
            <Icon size={22} aria-hidden="true" />
            <span>{label}</span>
          </a>
        ))}
      </nav>
      <main id="main-content" className="main-content" tabIndex={-1}>
        {page === 'learning' ? (
          <Suspense fallback={<p role="status">Opening learning studio…</p>}>
            <Learning
              onDirtyChange={setLearningDirty}
              initialFile={aiSource}
              onInitialSourceUsed={() => setAISource(null)}
              theme={theme}
              onThemeChange={setTheme}
            />
          </Suspense>
        ) : page === 'library' ? (
          <Library
            onOpen={(g, s) => load(g, s)}
            onNew={() => load(createBlankGraph(), undefined, undefined, [], 'edit')}
          />
        ) : page === 'practice' ? (
          <Practice
            graph={graph}
            onMission={() =>
              load(repairGraph(), undefined, '/examples/scholarship.svg', [], 'edit', true)
            }
            onReview={() => {
              setMode('review');
              navigate('workspace');
            }}
          />
        ) : page === 'guide' ? (
          <Guide />
        ) : sharedLoading ? (
          <div className="loading-lines" role="status">
            Opening shared diagram…
          </div>
        ) : sharedError && readonly ? (
          <div className="empty-library">
            <h1>Shared diagram unavailable</h1>
            <p role="alert">{sharedError}</p>
            <Button onClick={() => navigate('workspace')}>Open your workspace</Button>
          </div>
        ) : (
          <>
            <div className="page-heading workspace-heading">
              <div>
                <h1>{graph.title}</h1>
                <p>
                  {graph.source?.kind === 'sample'
                    ? 'Authored learning example · synthetic'
                    : readonly
                      ? 'Read-only shared diagram'
                      : (graph.source?.name ?? 'Your diagram')}
                  <span className="metadata-dot">·</span>
                  {graph.nodes.length} steps<span className="metadata-dot">·</span>
                  {graph.edges.length} connections
                </p>
              </div>
              <div className="workspace-actions">
                {readonly ? (
                  <Button
                    icon={Plus}
                    variant="primary"
                    onClick={() =>
                      load(
                        { ...graph, id: crypto.randomUUID() },
                        undefined,
                        undefined,
                        [],
                        'explore',
                      )
                    }
                  >
                    Make an editable copy
                  </Button>
                ) : (
                  <>
                    <Button
                      icon={Plus}
                      variant="ghost"
                      onClick={() => load(createBlankGraph(), undefined, undefined, [], 'edit')}
                    >
                      New
                    </Button>
                    <Button
                      icon={Upload}
                      onClick={() => fileInput.current?.click()}
                      disabled={importing}
                    >
                      Import diagram
                    </Button>
                    <Button variant="primary" icon={Save} onClick={beginSave}>
                      Save diagram
                    </Button>
                  </>
                )}
              </div>
            </div>
            {importing && (
              <div className="import-progress" role="status">
                <div>
                  <strong>{progress.text}</strong>
                  <progress max="100" value={progress.value} />
                </div>
                <Button onClick={() => abort.current?.abort()}>Cancel import</Button>
              </div>
            )}
            {!readonly && analysis.pendingReview > 0 && (
              <div className="draft-notice">
                <AlertTriangle size={19} aria-hidden="true" />
                <p>{analysis.pendingReview} labels or connections need review.</p>
                <Button variant="ghost" onClick={() => setMode('review')}>
                  Check source <ArrowRight size={16} aria-hidden="true" />
                </Button>
                {image?.startsWith('data:image/') && (
                  <Button icon={Sparkles} onClick={() => void structureWithAI()}>
                    Structure image with AI
                  </Button>
                )}
              </div>
            )}
            {mission && (
              <div className="mission-banner">
                <Wrench size={21} aria-hidden="true" />
                <p>Repair mission: reconnect document verification to approval.</p>
                <Button onClick={() => setMissionFeedback(checkRepair(graph).message)}>
                  Check repair
                </Button>
              </div>
            )}
            {missionFeedback && (
              <p className="notice" role="status">
                {missionFeedback}
              </p>
            )}
            <div className="workspace-toolbar">
              <div className="mode-switch" role="group" aria-label="Workspace view">
                {(['explore', 'edit', 'review', 'compare'] as const)
                  .filter((m) => !readonly || m === 'explore')
                  .map((m) => (
                    <button
                      key={m}
                      aria-pressed={mode === m}
                      className={mode === m ? 'active' : ''}
                      onClick={() => setMode(m)}
                    >
                      {m === 'review' ? 'Review source' : m.charAt(0).toUpperCase() + m.slice(1)}
                    </button>
                  ))}
              </div>
              <div className="toolbar-actions">
                {!readonly && (
                  <>
                    <IconButton
                      icon={Undo2}
                      label="Undo edit"
                      disabled={!undo.length}
                      onClick={undoEdit}
                    />
                    <IconButton
                      icon={Redo2}
                      label="Redo edit"
                      disabled={!redo.length}
                      onClick={redoEdit}
                    />
                  </>
                )}
                <details className="export-menu" ref={exportMenu}>
                  <summary>
                    <Download size={17} aria-hidden="true" /> Export
                  </summary>
                  <div className="export-options">
                    <button onClick={() => exportFile('json')}>Editable JSON graph</button>
                    <button onClick={() => exportFile('text')}>Structured text</button>
                    <button onClick={() => exportFile('html')}>HTML learning pack</button>
                    <button onClick={() => exportFile('svg')}>Visual SVG diagram</button>
                  </div>
                </details>
                {!readonly && (
                  <IconButton
                    icon={Link2}
                    label="Share read-only diagram"
                    onClick={() => {
                      setShareOpen(true);
                      setShareError('');
                      setShareUrl(
                        saved?.shareToken
                          ? `${window.location.origin}/#share/${saved.shareToken}`
                          : '',
                      );
                    }}
                  />
                )}
              </div>
            </div>
            <div className={`workspace-grid mode-${mode}`}>
              <section className="diagram-workarea" aria-label="Diagram canvas and controls">
                <div className="canvas-toolbar">
                  <span className={`badge ${analysis.pendingReview ? 'warning' : 'success'}`}>
                    {analysis.pendingReview ? (
                      <AlertTriangle size={14} aria-hidden="true" />
                    ) : (
                      <CheckCircle2 size={14} aria-hidden="true" />
                    )}
                    {analysis.pendingReview ? 'Draft structure' : 'Confirmed structure'}
                  </span>
                  <div>
                    <IconButton
                      icon={ZoomOut}
                      label="Zoom diagram out"
                      disabled={zoom <= 0.7}
                      onClick={() => setZoom((z) => Math.max(0.7, z - 0.1))}
                    />
                    <span className="zoom-value">{Math.round(zoom * 100)}%</span>
                    <IconButton
                      icon={ZoomIn}
                      label="Zoom diagram in"
                      disabled={zoom >= 1.5}
                      onClick={() => setZoom((z) => Math.min(1.5, z + 0.1))}
                    />
                    <IconButton
                      icon={hidden ? Eye : EyeOff}
                      label={hidden ? 'Show visual diagram' : 'Hide visual diagram'}
                      onClick={() => setHidden(!hidden)}
                    />
                  </div>
                </div>
                <div
                  className="zoom-frame"
                  style={{ '--diagram-zoom': zoom } as React.CSSProperties}
                >
                  <GraphCanvas
                    image={image}
                    graph={graph}
                    selectedId={selectedId}
                    path={path}
                    onSelect={select}
                    changedEdges={mode === 'compare' ? changedEdges : undefined}
                    hidden={hidden}
                  />
                </div>
                <div className="canvas-footer">
                  <span>
                    {readonly
                      ? 'Read-only snapshot'
                      : dirty
                        ? 'Unsaved edits'
                        : saved
                          ? `Saved ${saved.storage === 'device' ? 'on this device' : 'privately'}`
                          : 'Explore the example or import your own diagram'}
                  </span>
                  <span>{analysis.outcomes.length} outcomes</span>
                </div>
                {(analysis.unreachable.length > 0 ||
                  analysis.deadEnds.length > 0 ||
                  analysis.cycles.length > 0) && (
                  <details className="graph-notes">
                    <summary>Structure observations</summary>
                    <ul>
                      {analysis.unreachable.map((id) => (
                        <li key={'u' + id}>
                          {graph.nodes.find((n) => n.id === id)?.label} cannot be reached from the
                          starting step.
                        </li>
                      ))}
                      {analysis.deadEnds.map((id) => (
                        <li key={'d' + id}>
                          {graph.nodes.find((n) => n.id === id)?.label} has no outgoing connection.
                        </li>
                      ))}
                      {analysis.cycles.map((cycle, i) => (
                        <li key={'c' + i}>
                          Loop:{' '}
                          {cycle
                            .map((id) => graph.nodes.find((n) => n.id === id)?.label)
                            .join(' → ')}
                          . Loops may be intentional.
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
              </section>
              {mode === 'explore' || readonly ? (
                <Explorer
                  graph={graph}
                  selectedId={selectedId}
                  path={path}
                  onWalk={walk}
                  onBack={() => {
                    if (path.length > 1) {
                      setSelected(path[path.length - 2]);
                      setPath(path.slice(0, -1));
                    }
                  }}
                  onSelect={select}
                />
              ) : mode === 'edit' ? (
                <Editor
                  key={
                    selectedId +
                    graph.nodes.find((n) => n.id === selectedId)?.label +
                    graph.nodes.find((n) => n.id === selectedId)?.type
                  }
                  graph={graph}
                  selectedId={selectedId}
                  onCommit={commit}
                  onSelect={select}
                />
              ) : mode === 'review' ? (
                <Review
                  graph={graph}
                  image={image}
                  notes={notes}
                  selectedId={selectedId}
                  onSelect={select}
                  onCommit={commit}
                  onEdit={() => setMode('edit')}
                  onAI={
                    image && /^data:image\/(png|jpeg|webp);base64,/.test(image)
                      ? () => void structureWithAI()
                      : undefined
                  }
                />
              ) : (
                <Compare
                  before={baseline}
                  after={graph}
                  onBaseline={() => {
                    setBaseline(structuredClone(graph));
                    setMessage('Current diagram is now the comparison baseline.');
                  }}
                  onImport={() => baselineInput.current?.click()}
                />
              )}
            </div>
            <p className="workspace-footnote">
              Tab through steps and controls. Explore branches at your own pace.{' '}
              <a href="#guide">Read the accessibility guide</a>.
            </p>
          </>
        )}
      </main>
      <input
        ref={fileInput}
        type="file"
        accept=".json,.svg,.png,.jpg,.jpeg,.webp"
        className="hidden-input"
        aria-label="Import diagram file"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void chooseImport(file);
        }}
      />
      <ImageImportChoice
        file={pendingImage}
        onClose={() => setPendingImage(null)}
        onAI={(file) => {
          setPendingImage(null);
          setAISource(file);
          navigate('learning');
        }}
        onLocal={(file) => {
          setPendingImage(null);
          void handleImport(file);
        }}
      />
      <input
        ref={baselineInput}
        type="file"
        accept=".json,.svg"
        className="hidden-input"
        aria-label="Import comparison baseline"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleImport(file, true);
        }}
      />
      {page !== 'learning' && (
        <>
          <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
            {describeNode(graph, selectedId)}
          </div>
          <div className="sr-only" aria-live="polite">
            {graphSummary(graph)}
          </div>
        </>
      )}
      {message && (
        <div className="toast" role="status">
          <span>{message}</span>
          <IconButton icon={X} label="Dismiss message" onClick={() => setMessage('')} />
        </div>
      )}
      <Dialog
        open={saveOpen}
        title="Save your diagram"
        onClose={() => {
          if (!saving) setSaveOpen(false);
        }}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
        >
          <label className="field">
            Diagram title
            <input
              value={saveName}
              maxLength={160}
              onChange={(e) => setSaveName(e.target.value)}
              required
              disabled={saving}
            />
          </label>
          <fieldset className="save-locations">
            <legend>Where should it be saved?</legend>
            <label>
              <input
                type="radio"
                name="save-location"
                value="device"
                checked={saveWhere === 'device'}
                onChange={() => setSaveWhere('device')}
              />
              <span>
                <strong>On this device</strong>
                <span>Graph stays in this browser.</span>
              </span>
            </label>
            <label>
              <input
                type="radio"
                name="save-location"
                value="workspace"
                checked={saveWhere === 'workspace'}
                onChange={() => setSaveWhere('workspace')}
              />
              <span>
                <strong>Private guest workspace</strong>
                <span>
                  Save labels and connections to the server. Original image pixels stay on this
                  device.
                </span>
              </span>
            </label>
          </fieldset>
          {saved && (
            <label className="check-field">
              <input type="checkbox" checked={copy} onChange={(e) => setCopy(e.target.checked)} />
              Save as a new copy
            </label>
          )}
          {saveError && (
            <p className="inline-error" role="alert">
              {saveError}
            </p>
          )}
          <div className="dialog-actions">
            <Button type="button" onClick={() => setSaveOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button
              variant="primary"
              type="submit"
              disabled={saving || !saveName.trim()}
              icon={Save}
            >
              {saving ? 'Saving…' : 'Save diagram'}
            </Button>
          </div>
        </form>
      </Dialog>
      <Dialog
        open={shareOpen}
        title="Share a read-only diagram"
        onClose={() => {
          if (!sharing) setShareOpen(false);
        }}
      >
        <p>
          Anyone with the link can read this graph's labels and connections. Sharing saves a
          snapshot to the server. Original image pixels are excluded.
        </p>
        {analysis.pendingReview > 0 && (
          <p className="notice">
            Confirm the {analysis.pendingReview} unreviewed items before sharing.
          </p>
        )}
        {shareUrl && (
          <label className="field">
            Read-only link
            <input value={shareUrl} readOnly onFocus={(e) => e.target.select()} />
          </label>
        )}
        {shareError && (
          <p className="inline-error" role="alert">
            {shareError}
          </p>
        )}
        <div className="share-actions">
          {shareUrl && (
            <Button
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(shareUrl);
                  setMessage('Share link copied.');
                } catch {
                  setShareError('Copy is unavailable. Select and copy the link above.');
                }
              }}
            >
              Copy link
            </Button>
          )}
          <Button
            variant="primary"
            disabled={sharing || analysis.pendingReview > 0}
            icon={Link2}
            onClick={() => void publish()}
          >
            {sharing
              ? 'Creating link…'
              : shareUrl
                ? 'Create replacement link'
                : 'Create read-only link'}
          </Button>
          {saved?.storage === 'workspace' && saved.shareToken && (
            <Button
              variant="ghost"
              disabled={sharing}
              onClick={async () => {
                setSharing(true);
                try {
                  await revokeRemote(saved.id);
                  setSaved({ ...saved, shareToken: undefined });
                  setShareUrl('');
                  setMessage('Share link revoked.');
                } catch (e) {
                  setShareError(e instanceof Error ? e.message : 'The link could not be revoked.');
                } finally {
                  setSharing(false);
                }
              }}
            >
              Revoke link
            </Button>
          )}
        </div>
      </Dialog>
      {page !== 'learning' && !readonly && (
        <>
          <Button
            className="workspace-ai-launcher"
            icon={Sparkles}
            aria-label="Open AI workspace assistant"
            onClick={() => setAssistantOpen(true)}
          >
            AI
          </Button>
          <Dialog
            open={assistantOpen}
            title="Your AI workspace"
            onClose={() => setAssistantOpen(false)}
          >
            <p>
              Turn a source into an editable diagram, clear notes and practice. Choose how you want
              the AI to explain it in Learning.
            </p>
            <div className="study-toolbar">
              {image && /^data:image\/(png|jpeg|webp);base64,/.test(image) && (
                <Button
                  variant="primary"
                  icon={Sparkles}
                  onClick={() => {
                    setAssistantOpen(false);
                    void structureWithAI();
                  }}
                >
                  Structure this image
                </Button>
              )}
              <Button
                onClick={() => {
                  setAssistantOpen(false);
                  navigate('learning');
                }}
              >
                Open learning assistant
              </Button>
              <Button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
                Switch to {theme === 'dark' ? 'light' : 'dark'} theme
              </Button>
            </div>
          </Dialog>
        </>
      )}
      <Dialog
        open={leaveLearning !== null}
        title="Leave without saving?"
        onClose={() => setLeaveLearning(null)}
      >
        <p>
          Your learning notes or diagrams have unsaved edits. Keep editing to save them, or leave
          and discard those edits.
        </p>
        <div className="dialog-actions">
          <Button onClick={() => setLeaveLearning(null)}>Keep editing</Button>
          <Button
            variant="danger"
            onClick={() => {
              const next = leaveLearning;
              setLeaveLearning(null);
              setLearningDirty(false);
              if (next !== null) {
                window.history.pushState(null, '', '#' + next);
                setPage(next);
              }
            }}
          >
            Discard edits and leave
          </Button>
        </div>
      </Dialog>
      <Dialog open={!!discard} title="Open another diagram?" onClose={() => setDiscard(null)}>
        <p>
          Your current edits have not been saved. Keep editing to save or export them, or open the
          other diagram.
        </p>
        <div className="dialog-actions">
          <Button onClick={() => setDiscard(null)}>Keep editing</Button>
          <Button
            variant="danger"
            onClick={() => {
              const run = discard;
              setDiscard(null);
              run?.();
            }}
          >
            Open other diagram
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
