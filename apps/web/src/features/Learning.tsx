import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { Upload, Plus, ArrowLeft, Save, Trash2, FileText, Download } from 'lucide-react';
import { studyMarkdown, type StudyAnalysis } from '@graphear/core';
import { Button, Dialog } from '../components/ui';
import { download, filename } from '../lib/storage';
import {
  learningConfig,
  learningList,
  learningGet,
  learningUpload,
  learningAction,
  learningSave,
  learningDelete,
  learningExport,
  type LearningSession,
  type LearningConfig,
  type LearningSummary,
} from '../lib/learning-api';
import { SourcesView, NotesView, TutorView, RevisionView } from './learning/StudyViews';
import './learning/learning.css';
const DiagramEditor = lazy(() =>
  import('./learning/DiagramEditor').then((m) => ({ default: m.DiagramEditor })),
);
const activeStatuses = ['queued', 'extracting', 'generating'];
const accept = '.png,.jpg,.jpeg,.webp,.pdf,.docx,.pptx,.mp4,.mov,.webm,.mkv,.mp3,.wav,.m4a';
const errorMessage = (e: unknown) =>
  e instanceof Error ? e.message : 'This action could not be completed. Try again.';
function Preview({ file }: { file: File | null }) {
  const [url, setUrl] = useState('');
  useEffect(() => {
    if (!file) return;
    const next = URL.createObjectURL(file);
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [file]);
  if (!file) return null;
  return (
    <div className="study-upload-preview">
      {file.type.startsWith('image/') ? (
        <img src={url} alt="Selected learning material" />
      ) : file.type.startsWith('video/') ? (
        <video src={url} controls preload="metadata" />
      ) : file.type.startsWith('audio/') ? (
        <audio src={url} controls preload="metadata" />
      ) : (
        <FileText size={30} aria-hidden="true" />
      )}
      <div>
        <strong>{file.name}</strong>
        <p>{(file.size / 1024 / 1024).toFixed(2)} MB</p>
      </div>
    </div>
  );
}
function UploadForm({
  config,
  onCreated,
}: {
  config: LearningConfig | null;
  onCreated: (s: LearningSession) => void;
}) {
  const [kind, setKind] = useState<'file' | 'text' | 'youtube'>('file'),
    [file, setFile] = useState<File | null>(null),
    [text, setText] = useState(''),
    [url, setUrl] = useState(''),
    [subject, setSubject] = useState('General education'),
    [consent, setConsent] = useState(false),
    [busy, setBusy] = useState(false),
    [progress, setProgress] = useState(0),
    [error, setError] = useState(''),
    [drag, setDrag] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  function choose(f: File | undefined) {
    setError('');
    if (!f) return;
    const ext = f.name.split('.').at(-1)?.toLowerCase();
    if (!accept.split(',').includes('.' + ext)) {
      setError('Choose PNG, JPG, WEBP, PDF, DOCX, PPTX, MP4, MOV, WEBM, MKV, MP3, WAV or M4A.');
      return;
    }
    const media = ['mp4', 'mov', 'webm', 'mkv', 'mp3', 'wav', 'm4a'].includes(ext ?? '');
    if (f.size > (media ? (config?.limits.uploadMB ?? 100) : 20) * 1024 * 1024) {
      setError(
        media
          ? 'Media exceeds the configured upload limit.'
          : 'Images and documents are limited to 20 MB.',
      );
      return;
    }
    setFile(f);
  }
  async function submit(process: boolean) {
    setBusy(true);
    setError('');
    setProgress(0);
    try {
      const form = new FormData();
      form.append('kind', kind);
      form.append('title', subject === 'General education' ? 'Learning session' : subject);
      form.append(
        'options',
        JSON.stringify({
          subject,
          consent,
          difficulty: 'medium',
          questionCount: 5,
          noteStyle: 'detailed',
        }),
      );
      form.append('process', String(process));
      form.append('text', text);
      if (file && kind !== 'text') form.append('file', file);
      if (kind === 'youtube') form.append('url', url);
      onCreated(await learningUpload(form, setProgress));
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="study-upload">
      <h2>What are you learning today?</h2>
      <p>
        Bring a diagram, document or recording. Keep the source beside your notes and check every
        reconstruction.
      </p>
      <div className="mode-switch" role="group" aria-label="Learning input">
        {(['file', 'text', 'youtube'] as const).map((k) => (
          <Button
            key={k}
            aria-pressed={kind === k}
            onClick={() => {
              setKind(k);
              setError('');
            }}
            disabled={busy}
          >
            {k === 'file' ? 'Upload material' : k === 'text' ? 'Paste text' : 'YouTube video'}
          </Button>
        ))}
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void submit(Boolean(config?.configured && config.available !== false));
        }}
      >
        {kind !== 'text' && (
          <>
            <input
              ref={input}
              id="learning-file"
              aria-label="Select learning material file"
              type="file"
              accept={kind === 'youtube' ? '.mp4,.mov,.webm,.mkv,.mp3,.wav,.m4a' : accept}
              disabled={busy}
              onChange={(e) => choose(e.target.files?.[0])}
            />
            {kind === 'file' && (
              <div
                className={`study-dropzone ${drag ? 'dragging' : ''}`}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDrag(true);
                }}
                onDragLeave={() => setDrag(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDrag(false);
                  if (!busy) choose(e.dataTransfer.files[0]);
                }}
              >
                <Upload size={28} aria-hidden="true" />
                <strong>Drop your learning material here</strong>
                <p>Images, documents, video or audio</p>
                <Button type="button" onClick={() => input.current?.click()} disabled={busy}>
                  Choose a file
                </Button>
                <p className="muted">
                  Images/documents: 20 MB · Media: {config?.limits.uploadMB ?? 100} MB,{' '}
                  {config?.limits.mediaMinutes ?? 30} minutes
                </p>
              </div>
            )}
            <Preview file={file} />
            {file && (
              <Button
                type="button"
                variant="ghost"
                disabled={busy}
                onClick={() => {
                  setFile(null);
                  if (input.current) input.current.value = '';
                }}
              >
                Remove selected file
              </Button>
            )}
          </>
        )}
        {kind === 'youtube' && (
          <>
            <label>
              YouTube URL
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://www.youtube.com/watch?v=…"
                required
                maxLength={500}
              />
            </label>
            <p className="notice">
              Captions require permitted official API access. If unavailable, paste a transcript or
              attach audio/video you are authorized to process.
            </p>
            <label>
              Transcript (optional)
              <textarea
                rows={6}
                value={text}
                maxLength={180000}
                onChange={(e) => setText(e.target.value)}
                placeholder="Paste the educational transcript…"
              />
            </label>
            <Button type="button" onClick={() => input.current?.click()}>
              Attach authorized recording
            </Button>
          </>
        )}
        {kind === 'text' && (
          <label>
            Educational content
            <textarea
              rows={12}
              value={text}
              maxLength={180000}
              onChange={(e) => setText(e.target.value)}
              placeholder="Paste notes, an explanation or a lesson transcript…"
              required
            />
          </label>
        )}
        <label>
          Subject
          <input
            value={subject}
            maxLength={150}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="For example, computer networks"
          />
        </label>
        <label className="study-consent">
          <input
            type="checkbox"
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
            required
            disabled={busy}
          />
          I’m authorized to use this material. I agree to private server storage and AI processing
          by {config?.provider ?? 'the configured provider'}.
        </label>
        <p className="muted">
          Uploaded files expire after {config?.limits.retentionHours ?? 168} hours. Notes and source
          text stay in this private guest workspace until deleted. AI requests may incur provider
          charges.
        </p>
        {error && (
          <p className="error-text" role="alert">
            {error}
          </p>
        )}
        {busy && (
          <div role="status">
            <p>
              {progress < 100 ? 'Uploading material…' : 'Saving source and creating your session…'}
            </p>
            <progress value={progress} max={100} aria-label="Upload progress" />
          </div>
        )}
        <div className="study-toolbar">
          <Button
            variant="primary"
            type="submit"
            disabled={busy || !consent || !config || (kind === 'file' && !file)}
            icon={Upload}
          >
            {busy
              ? 'Uploading…'
              : config?.configured && config.available !== false
                ? 'Create learning session'
                : 'Save source draft'}
          </Button>
          {config?.configured && config.available !== false && (
            <Button
              type="button"
              disabled={busy || !consent || (kind === 'file' && !file)}
              onClick={() => void submit(false)}
            >
              Save draft only
            </Button>
          )}
        </div>
      </form>
    </section>
  );
}
export function Learning({ onDirtyChange }: { onDirtyChange: (dirty: boolean) => void }) {
  const [config, setConfig] = useState<LearningConfig | null>(null),
    [list, setList] = useState<LearningSummary[]>([]),
    [session, setSession] = useState<LearningSession | null>(null),
    [tab, setTab] = useState('notes'),
    [source, setSource] = useState(''),
    [diagram, setDiagram] = useState(''),
    [dirty, setDirty] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [notice, setNotice] = useState(''),
    [deleteOpen, setDeleteOpen] = useState(false),
    [pending, setPending] = useState<(() => void) | null>(null),
    [loading, setLoading] = useState(true),
    [exportStyle, setExportStyle] = useState('detailed');
  const id = session?.id,
    status = session?.status;
  useEffect(() => {
    onDirtyChange(dirty);
  }, [dirty, onDirtyChange]);
  useEffect(() => () => onDirtyChange(false), [onDirtyChange]);
  async function refresh() {
    setList(await learningList());
  }
  useEffect(() => {
    let alive = true;
    void Promise.all([learningConfig(), learningList()])
      .then(([c, l]) => {
        if (alive) {
          setConfig(c);
          setList(l);
        }
      })
      .catch((e) => {
        if (alive) setError(errorMessage(e));
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);
  useEffect(() => {
    if (config?.available !== false || !config.retryAt) return;
    const reset = Date.parse(config.retryAt);
    if (!Number.isFinite(reset)) return;
    const timer = setTimeout(
      () => {
        void learningConfig()
          .then(setConfig)
          .catch(() => undefined);
      },
      Math.min(2_147_483_647, Math.max(1000, reset - Date.now() + 1000)),
    );
    return () => clearTimeout(timer);
  }, [config?.available, config?.retryAt]);
  useEffect(() => {
    if (!id || !status || !activeStatuses.includes(status)) return;
    let alive = true;
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      try {
        const result = await learningGet(id);
        if (alive) {
          setSession(result);
          if (activeStatuses.includes(result.status)) timer = setTimeout(() => void poll(), 2500);
          else {
            void refresh().catch(() => undefined);
            void learningConfig()
              .then(setConfig)
              .catch(() => undefined);
          }
        }
      } catch (e) {
        if (alive) {
          setError(errorMessage(e));
          timer = setTimeout(() => void poll(), 10000);
        }
      }
    };
    timer = setTimeout(() => void poll(), 1800);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [id, status]);
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (dirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);
  const ready = session?.status === 'completed' && Boolean(session.analysis),
    processing = status && activeStatuses.includes(status),
    enabled = Boolean(config?.configured && config.available !== false) && !dirty;
  function switchSafe(action: () => void) {
    if (dirty) setPending(() => action);
    else action();
  }
  function created(s: LearningSession) {
    setSession(s);
    setDirty(false);
    setError('');
    setNotice('');
    setTab('notes');
    setSource('');
    setDiagram('');
    void refresh().catch(() => undefined);
  }
  async function open(id: string) {
    setBusy(true);
    setError('');
    try {
      created(await learningGet(id));
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  function change(a: StudyAnalysis) {
    if (session) {
      setSession({ ...session, analysis: a });
      setDirty(true);
    }
  }
  async function save() {
    if (!session) return;
    setBusy(true);
    setError('');
    try {
      setSession(await learningSave(session));
      setDirty(false);
      setNotice('Session changes saved.');
      await refresh();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  async function action(name: string, body: unknown = {}) {
    if (!session) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      setSession(await learningAction(session.id, name, body));
      await refresh();
    } catch (e) {
      setError(errorMessage(e));
      void learningConfig()
        .then(setConfig)
        .catch(() => undefined);
      throw e;
    } finally {
      setBusy(false);
    }
  }
  function citation(id: string) {
    setSource(id);
    setTab('source');
  }
  async function exportFile(format: string) {
    if (!session?.analysis) return;
    setBusy(true);
    setError('');
    try {
      if (format === 'markdown')
        download(
          filename(session.title) + '.md',
          studyMarkdown(
            session.analysis,
            session.sources,
            exportStyle as 'detailed' | 'short' | 'exam',
          ),
          'text/markdown',
        );
      else {
        const blob = await learningExport(session.id, format, exportStyle);
        download(
          filename(session.title) +
            (format === 'package' ? '.zip' : format === 'docx' ? '.docx' : '.pdf'),
          blob,
        );
      }
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="learning-page">
      <div className="page-heading">
        <div>
          <h1>{session ? 'Your learning workspace' : 'Learning studio'}</h1>
          <p>
            {session
              ? 'Source-linked notes, diagrams and practice in one place.'
              : 'Turn your educational material into something you can explore.'}
          </p>
        </div>
        <div className="study-toolbar">
          {session && (
            <Button
              icon={ArrowLeft}
              disabled={busy}
              onClick={() =>
                switchSafe(() => {
                  setSession(null);
                  setDirty(false);
                })
              }
            >
              All sessions
            </Button>
          )}
          <Button
            icon={Plus}
            disabled={busy}
            onClick={() =>
              switchSafe(() => {
                setSession(null);
                setDirty(false);
              })
            }
          >
            New session
          </Button>
        </div>
      </div>
      {loading && <p role="status">Opening your private learning workspace…</p>}
      {error && (
        <div className="notice error-text" role="alert">
          {error}
          <Button
            variant="ghost"
            onClick={() => {
              setError('');
              void Promise.all([learningConfig().then(setConfig), refresh()]).catch((e) =>
                setError(errorMessage(e)),
              );
            }}
          >
            Refresh workspace
          </Button>
        </div>
      )}
      {notice && (
        <p role="status" className="notice">
          {notice}
        </p>
      )}
      {config && !config.configured && (
        <div className="notice">
          <strong>AI processing is not configured yet.</strong>
          <p>
            You can save source drafts. Ask your workspace administrator to configure{' '}
            {config.provider} access before processing material.
          </p>
        </div>
      )}
      {config?.configured && config.available === false && (
        <div className="notice" role="status">
          <strong>
            {config.freeTier ? 'Free AI quota reached' : 'AI is temporarily unavailable'}
          </strong>
          <p>
            {config.retryAt
              ? `Available again around ${new Date(config.retryAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}. `
              : 'Try again later. '}
            Your saved material is safe. You can keep source drafts and use the local diagram
            workspace.
          </p>
          <Button
            onClick={() => {
              void learningConfig()
                .then(setConfig)
                .catch((e) => setError(errorMessage(e)));
            }}
          >
            Check availability
          </Button>
        </div>
      )}
      {!session ? (
        <div className="study-start">
          <UploadForm config={config} onCreated={created} />
          <aside className="study-library">
            <h2>Saved learning sessions</h2>
            <p className="muted">
              Private to this browser’s guest workspace. Export important material before clearing
              browser cookies.
            </p>
            {!loading && !list.length && (
              <div className="study-library-empty">
                <FileText size={24} aria-hidden="true" />
                <p>Your first session will appear here.</p>
              </div>
            )}
            {list.map((s) => (
              <button
                className="study-session-row"
                key={s.id}
                disabled={busy}
                onClick={() => void open(s.id)}
              >
                <strong>{s.title}</strong>
                <span>
                  {s.status} · {new Date(s.updatedAt).toLocaleDateString()}
                </span>
                {activeStatuses.includes(s.status) && (
                  <progress
                    value={s.progress}
                    max={100}
                    aria-label={`${s.title} processing progress`}
                  />
                )}
              </button>
            ))}
          </aside>
        </div>
      ) : (
        <section className="study-session">
          <div className="study-session-heading">
            <label>
              Session name
              <input
                value={session.title}
                disabled={busy || Boolean(processing)}
                maxLength={180}
                onChange={(e) => {
                  setSession({ ...session, title: e.target.value });
                  setDirty(true);
                }}
              />
            </label>
            <div className="study-toolbar">
              <span className={`badge ${ready ? 'success' : 'warning'}`}>
                {dirty ? 'Unsaved edits' : session.status}
              </span>
              <Button
                icon={Save}
                disabled={busy || !dirty || Boolean(processing) || !session.title.trim()}
                onClick={() => void save()}
              >
                Save changes
              </Button>
              <Button
                icon={Trash2}
                variant="danger"
                disabled={busy}
                onClick={() => setDeleteOpen(true)}
              >
                Delete session
              </Button>
            </div>
          </div>
          {processing && (
            <div className="study-job" role="status">
              <h2>{session.message}</h2>
              <progress
                value={session.progress}
                max={100}
                aria-label="Learning processing progress"
              />
              <p>
                Extracting and validating your material. You can return to this session while
                processing continues.
              </p>
              <Button disabled={busy} onClick={() => void action('cancel').catch(() => undefined)}>
                Cancel processing
              </Button>
            </div>
          )}
          {session.error && (
            <p className="notice error-text" role="alert">
              {session.error}
            </p>
          )}
          {!ready && !processing && (
            <div className="study-job">
              <h2>{status === 'draft' ? 'Your source is saved' : 'Processing needs attention'}</h2>
              <p>{session.message}</p>
              <Preview file={null} />
              {session.input.text && (
                <details>
                  <summary>Saved source text</summary>
                  <p className="study-source-text">{session.input.text}</p>
                </details>
              )}
              {session.fileUrl && (
                <a href={session.fileUrl} download>
                  Download saved original
                </a>
              )}
              <p className="muted">
                {config?.freeTier
                  ? 'Processing uses the free AI allowance. Retry when quota is available. '
                  : 'Retrying can make additional billable AI calls. '}
                Previously extracted sections are reused when available.
              </p>
              <Button
                variant="primary"
                disabled={busy || !enabled}
                onClick={() => void action('process').catch(() => undefined)}
              >
                {status === 'draft' ? 'Process material' : 'Retry processing'}
              </Button>
            </div>
          )}
          {ready && session.analysis && (
            <>
              <div className="study-tabs" role="group" aria-label="Learning workspace views">
                {[
                  ['source', 'Original source'],
                  ['notes', 'Notes'],
                  ['diagrams', 'Diagrams'],
                  ['tutor', 'AI tutor'],
                  ['revision', 'Revision'],
                  ['export', 'Export'],
                ].map(([k, label]) => (
                  <Button key={k} aria-pressed={tab === k} onClick={() => setTab(k)}>
                    {label}
                  </Button>
                ))}
              </div>
              {dirty && (
                <p className="notice">
                  Save your edits before requesting AI help or exporting server-generated files.
                </p>
              )}
              {tab === 'source' && (
                <SourcesView session={session} selected={source} setSelected={setSource} />
              )}
              {tab === 'notes' && (
                <NotesView
                  analysis={session.analysis}
                  sources={session.sources}
                  onChange={change}
                  onSource={citation}
                  disabled={busy}
                />
              )}
              {tab === 'diagrams' && (
                <div className="study-diagrams">
                  {session.analysis.diagrams.length ? (
                    <>
                      <label>
                        Diagram
                        <select
                          value={diagram || session.analysis.diagrams[0].id}
                          onChange={(e) => setDiagram(e.target.value)}
                        >
                          {session.analysis.diagrams.map((d) => (
                            <option key={d.id} value={d.id}>
                              {d.title} ({d.kind})
                            </option>
                          ))}
                        </select>
                      </label>
                      <Suspense fallback={<p role="status">Opening diagram editor…</p>}>
                        <DiagramEditor
                          key={diagram || session.analysis.diagrams[0].id}
                          diagram={
                            session.analysis.diagrams.find((d) => d.id === diagram) ??
                            session.analysis.diagrams[0]
                          }
                          disabled={busy}
                          sources={session.sources}
                          onSource={citation}
                          onChange={(d) =>
                            change({
                              ...session.analysis!,
                              diagrams: session.analysis!.diagrams.map((v) =>
                                v.id === d.id ? d : v,
                              ),
                            })
                          }
                        />
                      </Suspense>
                    </>
                  ) : (
                    <p>
                      No diagram was supported by this source. Ask the tutor for a diagram when
                      useful.
                    </p>
                  )}
                </div>
              )}
              {tab === 'tutor' && (
                <TutorView
                  session={session}
                  busy={busy}
                  enabled={enabled}
                  onSource={citation}
                  onAsk={(q, d) => action('chat', { question: q, diagram: d })}
                />
              )}{' '}
              {tab === 'revision' && (
                <RevisionView
                  key={session.analysis.questions.map((q) => q.id).join('-')}
                  session={session}
                  busy={busy}
                  enabled={enabled}
                  onSource={citation}
                  onGenerate={(count, difficulty) => action('questions', { count, difficulty })}
                  onResult={(answers) => action('quiz', { answers })}
                />
              )}
              {tab === 'export' && (
                <section className="study-export">
                  <h2>Take your learning with you</h2>
                  <p>
                    Exports include source references and uncertainty labels. Check diagrams against
                    your source before using them in an exam answer.
                  </p>
                  <label>
                    Notes format
                    <select value={exportStyle} onChange={(e) => setExportStyle(e.target.value)}>
                      <option value="detailed">Detailed notes</option>
                      <option value="short">Short notes</option>
                      <option value="exam">Exam notes</option>
                    </select>
                  </label>
                  <div className="study-export-list">
                    {[
                      ['pdf', 'Notes PDF', 'Readable, paginated study notes.'],
                      ['docx', 'Notes DOCX', 'Editable document with headings and citations.'],
                      ['markdown', 'Markdown', 'Portable plain-text study notes.'],
                      ['flashcards', 'Flashcards PDF', 'Questions and answers for revision.'],
                      [
                        'package',
                        'Complete learning package',
                        'Notes, diagrams, sources and revision data in a ZIP.',
                      ],
                    ].map(([format, title, detail]) => (
                      <div key={format}>
                        <div>
                          <strong>{title}</strong>
                          <p>{detail}</p>
                        </div>
                        <Button
                          icon={Download}
                          disabled={busy || (dirty && format !== 'markdown')}
                          onClick={() => void exportFile(format)}
                        >
                          Download
                        </Button>
                      </div>
                    ))}
                  </div>
                  <p className="muted">Individual SVG and PNG exports are in the Diagrams view.</p>
                </section>
              )}
            </>
          )}
        </section>
      )}
      <footer className="study-footer">
        AI can misread a source. Review labels, relationships and explanations before relying on
        generated material. <a href="#guide">Accessibility guide</a>
      </footer>
      <Dialog
        open={deleteOpen}
        title="Delete learning session?"
        onClose={() => setDeleteOpen(false)}
      >
        <p>
          This removes the private uploaded files, notes, diagrams, chat and practice history.
          Export anything you want to keep first.
        </p>
        <div className="study-toolbar">
          <Button onClick={() => setDeleteOpen(false)}>Keep session</Button>
          <Button
            variant="danger"
            disabled={busy}
            onClick={() => {
              setBusy(true);
              void learningDelete(session!.id)
                .then(() => {
                  setSession(null);
                  setDirty(false);
                  setDeleteOpen(false);
                  return refresh();
                })
                .catch((e) => setError(errorMessage(e)))
                .finally(() => setBusy(false));
            }}
          >
            Delete permanently
          </Button>
        </div>
      </Dialog>
      <Dialog open={Boolean(pending)} title="Leave unsaved edits?" onClose={() => setPending(null)}>
        <p>Your latest edits have not been saved.</p>
        <div className="study-toolbar">
          <Button onClick={() => setPending(null)}>Keep editing</Button>
          <Button
            variant="danger"
            onClick={() => {
              pending?.();
              setPending(null);
              setDirty(false);
            }}
          >
            Discard edits
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
