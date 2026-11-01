import { useState } from 'react';
import { Sparkles, Sun, Moon } from 'lucide-react';
import type { StudyAnalysis, StudyDiagram } from '@graphear/core';
import { Button, Dialog } from '../../components/ui';
import { learningDiagramPreview, type LearningSession } from '../../lib/learning-api';
import { Citations } from './StudyViews';
export function WorkspaceAssistant({
  session,
  disabled,
  onChange,
  onQuestion,
  theme,
  onThemeChange,
  onSource,
}: {
  session: LearningSession | null;
  disabled: boolean;
  onChange: (a: StudyAnalysis) => void;
  onQuestion: (question: string) => Promise<void>;
  theme: string;
  onThemeChange?: (theme: string) => void;
  onSource: (id: string) => void;
}) {
  const [open, setOpen] = useState(false),
    [mode, setMode] = useState('ask'),
    [text, setText] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [selected, setSelected] = useState(session?.analysis?.diagrams[0]?.id ?? ''),
    [preview, setPreview] = useState<{ diagram: StudyDiagram; revision: number } | null>(null);
  const selectedDiagram =
    session?.analysis?.diagrams.find((diagram) => diagram.id === selected)?.id ??
    session?.analysis?.diagrams[0]?.id ??
    '';
  async function run() {
    if (!session?.analysis || disabled || !text.trim()) return;
    setBusy(true);
    setError('');
    setPreview(null);
    try {
      if (mode === 'ask') await onQuestion(text);
      else
        setPreview(
          await learningDiagramPreview(
            session,
            text,
            mode === 'edit' ? selectedDiagram : undefined,
          ),
        );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The AI request failed safely.');
    } finally {
      setBusy(false);
    }
  }
  function apply() {
    if (!session?.analysis || !preview) return;
    if (preview.revision !== session.revision) {
      setError('The session changed. Request a fresh preview.');
      return;
    }
    if (
      !session.analysis.diagrams.some((d) => d.id === preview.diagram.id) &&
      session.analysis.diagrams.length >= 12
    ) {
      setError('This session already has twelve diagrams. Remove one before adding another.');
      return;
    }
    const next = structuredClone(session.analysis),
      index = next.diagrams.findIndex((d) => d.id === preview.diagram.id);
    if (index < 0) next.diagrams.push(preview.diagram);
    else next.diagrams[index] = preview.diagram;
    onChange(next);
    setPreview(null);
    setOpen(false);
  }
  const answer = session?.chat.at(-1);
  return (
    <>
      <Button
        className="workspace-ai-launcher"
        icon={Sparkles}
        aria-label="Open AI workspace assistant"
        onClick={() => setOpen(true)}
      >
        AI
      </Button>
      <Dialog
        open={open}
        title="Your AI workspace"
        className="assistant-dialog"
        onClose={() => {
          if (!busy) setOpen(false);
        }}
      >
        <p>Explain your material, propose a clearer diagram, or adjust your reading space.</p>
        <div className="study-toolbar">
          <Button
            icon={Sun}
            aria-pressed={theme === 'light'}
            onClick={() => onThemeChange?.('light')}
          >
            Light
          </Button>
          <Button
            icon={Moon}
            aria-pressed={theme === 'dark'}
            onClick={() => onThemeChange?.('dark')}
          >
            Dark
          </Button>
        </div>
        {!session?.analysis ? (
          <p className="notice">
            Upload or open a completed learning session to chat about its sources. You can choose
            the diagram format and give custom instructions before processing.
          </p>
        ) : (
          <>
            <label>
              AI action
              <select
                aria-label="AI action"
                value={mode}
                disabled={busy}
                onChange={(e) => {
                  setMode(e.target.value);
                  setPreview(null);
                }}
              >
                <option value="ask">Explain or answer a question</option>
                <option value="edit">Change an existing diagram</option>
                <option value="new">Create a new diagram from these sources</option>
              </select>
            </label>
            {mode === 'edit' && (
              <label>
                Diagram to change
                <select
                  aria-label="Diagram to change"
                  value={selectedDiagram}
                  disabled={busy}
                  onChange={(e) => {
                    setSelected(e.target.value);
                    setPreview(null);
                  }}
                >
                  {session.analysis.diagrams.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.title}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <label>
              Your request
              <textarea
                aria-label="Your request"
                value={text}
                rows={4}
                maxLength={2000}
                disabled={busy}
                onChange={(e) => setText(e.target.value)}
                placeholder="Explain the OSI layers simply, or reorganize this diagram while preserving every connection."
              />
            </label>
            <p className="muted">
              Requests use the configured AI allowance. Diagram changes are previews until you
              accept them and save the session.
            </p>
            <Button
              variant="primary"
              icon={Sparkles}
              disabled={disabled || busy || !text.trim() || (mode === 'edit' && !selectedDiagram)}
              onClick={() => void run()}
            >
              {busy
                ? 'Reading your sources…'
                : mode === 'ask'
                  ? 'Ask AI'
                  : 'Generate diagram preview'}
            </Button>
            {disabled && (
              <p className="notice">
                Save pending edits and wait for processing or AI availability before making another
                request.
              </p>
            )}
            {open && mode === 'ask' && answer && (
              <article className="assistant-answer">
                <h3>AI response</h3>
                <p>{answer.result.answer}</p>
                {answer.result.uncertain && (
                  <p className="warning-text">Check uncertain details against the source.</p>
                )}
                <Citations
                  ids={answer.result.evidence}
                  sources={session.sources}
                  onSource={(id) => {
                    onSource(id);
                    setOpen(false);
                  }}
                />
              </article>
            )}
            {preview && (
              <section className="assistant-preview">
                <h3>{preview.diagram.title}</h3>
                <p>{preview.diagram.description}</p>
                <p>
                  {preview.diagram.kind} · {preview.diagram.nodes.length} components ·{' '}
                  {preview.diagram.edges.length} connections
                </p>
                <ul>
                  {preview.diagram.nodes.map((n) => (
                    <li key={n.id}>{n.label}</li>
                  ))}
                </ul>
                <details>
                  <summary>Review connections</summary>
                  <ul>
                    {preview.diagram.edges.map((e) => (
                      <li key={e.id}>
                        {preview.diagram.nodes.find((n) => n.id === e.source)?.label}{' '}
                        {e.direction === 'none' ? '—' : e.direction === 'both' ? '↔' : '→'}{' '}
                        {preview.diagram.nodes.find((n) => n.id === e.target)?.label}
                        {e.label ? ` (${e.label})` : ''}
                      </li>
                    ))}
                  </ul>
                </details>
                {preview.diagram.warnings.map((w, i) => (
                  <p key={i} className="notice">
                    {w}
                  </p>
                ))}
                <div className="study-toolbar">
                  <Button variant="primary" disabled={disabled || busy} onClick={apply}>
                    Apply to workspace
                  </Button>
                  <Button onClick={() => setPreview(null)}>Discard preview</Button>
                </div>
              </section>
            )}
          </>
        )}
        {error && (
          <p className="error-text" role="alert">
            {error}
          </p>
        )}
      </Dialog>
    </>
  );
}
