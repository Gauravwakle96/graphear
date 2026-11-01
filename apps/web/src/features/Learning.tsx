import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import {
  Upload,
  Plus,
  ArrowLeft,
  Save,
  Trash2,
  FileText,
  Download,
  Video,
  AudioLines,
  Play,
} from 'lucide-react';
import { studyMarkdown, categorySchema, type StudyAnalysis } from '@graphear/core';
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
import { WorkspaceAssistant } from './learning/WorkspaceAssistant';
import { StudyChecklist } from './learning/StudyChecklist';
const DiagramEditor = lazy(() =>
  import('./learning/DiagramEditor').then((m) => ({ default: m.DiagramEditor })),
);
const activeStatuses = ['queued', 'extracting', 'generating'];
const accept =
  '.png,.jpg,.jpeg,.webp,.pdf,.docx,.pptx,.txt,.md,.vtt,.srt,.mp4,.mov,.webm,.mkv,.mp3,.wav,.m4a';
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
  initialFile,
}: {
  config: LearningConfig | null;
  onCreated: (s: LearningSession) => void;
  initialFile?: File | null;
}) {
  const [kind, setKind] = useState<'file' | 'text' | 'youtube'>('file'),
    [fileCategory, setFileCategory] = useState('file'),
    [file, setFile] = useState<File | null>(initialFile ?? null),
    [text, setText] = useState(''),
    [url, setUrl] = useState(''),
    [subject, setSubject] = useState('General education'),
    [learningLevel, setLearningLevel] = useState('college'),
    [learningGoal, setLearningGoal] = useState('understand'),
    [noteStyle, setNoteStyle] = useState('detailed'),
    [difficulty, setDifficulty] = useState('medium'),
    [questionCount, setQuestionCount] = useState(5),
    [diagramKind, setDiagramKind] = useState('auto'),
    [diagramDetail, setDiagramDetail] = useState('faithful'),
    [notesLayout, setNotesLayout] = useState('bullets'),
    [useCase, setUseCase] = useState('study'),
    [instructions, setInstructions] = useState(''),
    [consent, setConsent] = useState(false),
    [busy, setBusy] = useState(false),
    [progress, setProgress] = useState(0),
    [error, setError] = useState(''),
    [drag, setDrag] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const canProcess = Boolean(
    config?.configured &&
    config.available !== false &&
    (kind !== 'youtube' || config.captionsConfigured || text.trim() || file),
  );
  function choose(f: File | undefined) {
    setError('');
    if (!f) return;
    if (kind === 'file' && fileCategory === 'video' && !/\.(mp4|mov|webm|mkv)$/i.test(f.name)) {
      setError('Choose a supported educational video.');
      return;
    }
    if (kind === 'file' && fileCategory === 'audio' && !/\.(mp3|wav|m4a)$/i.test(f.name)) {
      setError('Choose a supported educational recording.');
      return;
    }
    const ext = f.name.split('.').at(-1)?.toLowerCase();
    if (!accept.split(',').includes('.' + ext)) {
      setError(
        'Choose an image, PDF, Office document, TXT/Markdown notes, subtitles, video or audio.',
      );
      return;
    }
    const media = ['mp4', 'mov', 'webm', 'mkv', 'mp3', 'wav', 'm4a'].includes(ext ?? '');
    if (['txt', 'md', 'vtt', 'srt'].includes(ext ?? '') && f.size > 1_000_000) {
      setError('Text notes and transcripts are limited to 1 MB.');
      return;
    }
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
          difficulty,
          questionCount,
          diagramKind,
          diagramDetail,
          notesLayout,
          useCase,
          instructions,
          noteStyle,
          learningLevel,
          learningGoal,
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
      {initialFile && (
        <p className="notice">
          Your original image is ready. Choose the output below and authorize private AI processing
          to reconstruct it.
        </p>
      )}
      <div className="mode-switch" role="group" aria-label="Learning input">
        {(['file', 'video', 'audio', 'youtube', 'text'] as const).map((type) => {
          const k = type === 'video' || type === 'audio' ? 'file' : type;
          return (
            <Button
              key={type}
              icon={
                type === 'video'
                  ? Video
                  : type === 'audio'
                    ? AudioLines
                    : type === 'youtube'
                      ? Play
                      : type === 'file'
                        ? Upload
                        : FileText
              }
              aria-pressed={kind === k && (k !== 'file' || fileCategory === type)}
              onClick={() => {
                setKind(k);
                if (k === 'file' && fileCategory !== type) setFile(null);
                setFileCategory(type);
                setError('');
              }}
              disabled={busy}
            >
              {type === 'video'
                ? 'Video'
                : type === 'audio'
                  ? 'Audio'
                  : k === 'file'
                    ? 'Upload material'
                    : k === 'text'
                      ? 'Paste text'
                      : 'YouTube video'}
            </Button>
          );
        })}
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void submit(canProcess);
        }}
      >
        {kind !== 'text' && (
          <>
            <input
              ref={input}
              id="learning-file"
              aria-label="Select learning material file"
              type="file"
              accept={
                kind === 'youtube'
                  ? '.txt,.md,.vtt,.srt,.mp4,.mov,.webm,.mkv,.mp3,.wav,.m4a'
                  : fileCategory === 'video'
                    ? '.mp4,.mov,.webm,.mkv'
                    : fileCategory === 'audio'
                      ? '.mp3,.wav,.m4a'
                      : accept
              }
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
                <p>
                  {fileCategory === 'video'
                    ? 'Educational videos'
                    : fileCategory === 'audio'
                      ? 'Lectures and audio recordings'
                      : 'PDFs, images, documents and notes'}
                </p>
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
              Notes need the video's actual content. When caption access is unavailable, paste its
              transcript or attach authorized TXT/VTT/SRT or audio/video material.
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
              Attach transcript or recording
            </Button>
            {!config?.captionsConfigured && !text.trim() && !file && (
              <p className="notice" role="status">
                Add a transcript to generate notes. Open the video on YouTube, choose “Show
                transcript” when available, and copy its text with timestamps. You can save the link
                as a draft while preparing the transcript.
              </p>
            )}
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
        <fieldset className="study-learning-settings" disabled={busy}>
          <legend>Prepare this material for me</legend>
          <label>
            Workspace purpose
            <select
              aria-label="Workspace purpose"
              value={useCase}
              onChange={(e) => setUseCase(e.target.value)}
            >
              <option value="study">Study and exam preparation</option>
              <option value="scholarship">Scholarship application</option>
              <option value="hackathon">Hackathon preparation</option>
              <option value="process">Understand any process</option>
            </select>
          </label>
          <label>
            Learning level
            <select
              aria-label="Learning level"
              value={learningLevel}
              onChange={(e) => setLearningLevel(e.target.value)}
            >
              <option value="beginner">Beginner</option>
              <option value="school">School</option>
              <option value="college">College</option>
              <option value="advanced">Advanced</option>
            </select>
          </label>
          <label>
            Study goal
            <select
              aria-label="Study goal"
              value={learningGoal}
              onChange={(e) => setLearningGoal(e.target.value)}
            >
              <option value="understand">Understand the concepts</option>
              <option value="exam">Prepare for an exam</option>
              <option value="revision">Quick revision</option>
            </select>
          </label>
          <label>
            Preferred notes
            <select
              aria-label="Preferred notes"
              value={noteStyle}
              onChange={(e) => setNoteStyle(e.target.value)}
            >
              <option value="detailed">Detailed explanations</option>
              <option value="short">Short revision notes</option>
              <option value="exam">Exam answers</option>
            </select>
          </label>
          <label>
            Quiz difficulty
            <select
              aria-label="Quiz difficulty"
              value={difficulty}
              onChange={(e) => setDifficulty(e.target.value)}
            >
              <option value="easy">Easy</option>
              <option value="medium">Medium</option>
              <option value="hard">Hard</option>
            </select>
          </label>
          <label>
            Practice questions
            <input
              type="number"
              min={1}
              max={20}
              value={questionCount}
              onChange={(e) => setQuestionCount(Math.max(1, Math.min(20, Number(e.target.value))))}
            />
          </label>
        </fieldset>
        <fieldset className="study-learning-settings" disabled={busy}>
          <legend>Shape your output</legend>
          <label>
            Diagram format
            <select
              aria-label="Diagram format"
              value={diagramKind}
              onChange={(e) => setDiagramKind(e.target.value)}
            >
              <option value="auto">Choose the best format</option>
              {categorySchema.options.map((k) => (
                <option key={k} value={k}>
                  {k === 'mindmap'
                    ? 'Mind map'
                    : k === 'concept'
                      ? 'Concept graph'
                      : k.toUpperCase()}
                </option>
              ))}
            </select>
          </label>
          <label>
            Diagram detail
            <select
              aria-label="Diagram detail"
              value={diagramDetail}
              onChange={(e) => setDiagramDetail(e.target.value)}
            >
              <option value="faithful">Preserve original structure</option>
              <option value="simple">Easy to understand</option>
              <option value="expanded">Explain in more detail</option>
            </select>
          </label>
          <label>
            Notes presentation
            <select
              aria-label="Notes presentation"
              value={notesLayout}
              onChange={(e) => setNotesLayout(e.target.value)}
            >
              <option value="bullets">Expert notes in clear points</option>
              <option value="prose">Connected explanations</option>
            </select>
          </label>
          <label>
            Tell the AI what you need
            <textarea
              aria-label="Tell the AI what you need"
              rows={3}
              maxLength={2000}
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              placeholder="Explain the OSI layers simply, preserve their order and connections, and include a revision diagram."
            />
          </label>
        </fieldset>
        <label className="study-consent">
          <input
            type="checkbox"
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
            required
            disabled={busy}
          />
          I’m authorized to use this material. I agree to private server storage and AI processing
          by {config?.providerLabel ?? config?.provider ?? 'the configured provider'}.
        </label>
        <p className="muted">
          Uploaded files expire after {config?.limits.retentionHours ?? 168} hours. Notes and source
          text stay in this private guest workspace until deleted.{' '}
          {config?.freeTier
            ? 'AI processing uses the configured free allowance and remains subject to provider limits.'
            : 'AI requests may incur provider charges.'}
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
            {busy ? 'Uploading…' : canProcess ? 'Create learning session' : 'Save source draft'}
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
export function Learning({
  onDirtyChange,
  initialFile,
  onInitialSourceUsed,
  theme,
  onThemeChange,
}: {
  onDirtyChange: (dirty: boolean) => void;
  initialFile?: File | null;
  onInitialSourceUsed?: () => void;
  theme?: string;
  onThemeChange?: (theme: string) => void;
}) {
  const [config, setConfig] = useState<LearningConfig | null>(null),
    [list, setList] = useState<LearningSummary[]>([]),
    [session, setSession] = useState<LearningSession | null>(null),
    [tab, setTab] = useState('notes'),
    [source, setSource] = useState(''),
    [sourceTranscript, setSourceTranscript] = useState(''),
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
    setSourceTranscript('');
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
          <UploadForm
            config={config}
            initialFile={initialFile}
            onCreated={(s) => {
              onInitialSourceUsed?.();
              created(s);
            }}
          />
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
          {session.input.kind === 'youtube' && !session.analysis && !processing && (
            <section className="notice">
              <h2>Add the video transcript</h2>
              <p>
                Paste authorized transcript text, including timestamps when available. Saving it
                makes no AI calls.
              </p>
              <label>
                Video transcript
                <textarea
                  rows={6}
                  maxLength={180000}
                  value={sourceTranscript}
                  disabled={busy}
                  onChange={(e) => setSourceTranscript(e.target.value)}
                />
              </label>
              <Button
                disabled={busy || !sourceTranscript.trim() || dirty}
                onClick={() =>
                  void action('source', {
                    text: sourceTranscript,
                    revision: session.revision,
                  })
                }
              >
                Save transcript
              </Button>
            </section>
          )}
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
                onClick={() =>
                  void action(
                    'process',
                    session.options.visualAnalysis === false
                      ? { visualAnalysis: true, revision: session.revision }
                      : {},
                  ).catch(() => undefined)
                }
              >
                {session.options.visualAnalysis === false
                  ? 'Retry with image analysis'
                  : status === 'draft'
                    ? 'Process material'
                    : 'Retry processing'}
              </Button>
              {status === 'failed' &&
                session.sources.some((src) => src.text.trim()) &&
                session.sources.some((src) => src.asset) && (
                  <div>
                    <p className="muted">
                      For notes from readable source text, you can retry without image analysis.
                      Original figures will not be inspected; diagrams will explain the extracted
                      text.
                    </p>
                    <Button
                      disabled={busy || !enabled}
                      onClick={() =>
                        void action('process', {
                          visualAnalysis: false,
                          revision: session.revision,
                        }).catch(() => undefined)
                      }
                    >
                      Retry using extracted text
                    </Button>
                  </div>
                )}
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
                  ['checklist', 'Checklist'],
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
              {tab === 'checklist' && (
                <StudyChecklist key={session.id} session={session} onSource={citation} />
              )}
              {tab === 'notes' && (
                <NotesView
                  key={session.id}
                  initialStyle={session.options.noteStyle}
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
                  onResult={(answers, settings) => action('quiz', { answers, ...settings })}
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
      <WorkspaceAssistant
        key={session?.id ?? 'empty'}
        session={session}
        disabled={busy || !ready || !enabled}
        onChange={(a) => {
          change(a);
          setTab('diagrams');
        }}
        onQuestion={(question) => action('chat', { question, diagram: false })}
        theme={theme ?? 'light'}
        onThemeChange={onThemeChange}
        onSource={citation}
      />
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
