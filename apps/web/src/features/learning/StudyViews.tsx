import { useEffect, useRef, useState } from 'react';
import { timestamp, type Source, type StudyAnalysis } from '@graphear/core';
import { Button } from '../../components/ui';
import type { LearningSession } from '../../lib/learning-api';
export function Citations({
  ids,
  sources,
  onSource,
}: {
  ids: string[];
  sources: Source[];
  onSource: (id: string) => void;
}) {
  return ids.length ? (
    <div className="study-citations">
      {ids.map((id) => (
        <button key={id} className="text-button" onClick={() => onSource(id)}>
          {sources.find((s) => s.id === id)?.reference ?? id}
        </button>
      ))}
    </div>
  ) : null;
}
export function SourcesView({
  session,
  selected,
  setSelected,
}: {
  session: LearningSession;
  selected: string;
  setSelected: (id: string) => void;
}) {
  const player = useRef<HTMLMediaElement>(null);
  const sourceHeading = useRef<HTMLHeadingElement>(null);
  const src = session.sources.find((s) => s.id === selected) ?? session.sources[0];
  const start = src?.start;
  useEffect(() => {
    sourceHeading.current?.focus();
  }, [src?.id]);
  useEffect(() => {
    const media = player.current;
    if (!media || start == null) return;
    const seek = () => {
      if (media.readyState < 1 || !(media.duration > 0)) return;
      media.currentTime = Number.isFinite(media.duration) ? Math.min(start, media.duration) : start;
    };
    media.addEventListener('loadedmetadata', seek, { once: true });
    media.addEventListener('loadeddata', seek, { once: true });
    media.addEventListener('canplay', seek, { once: true });
    seek();
    return () => {
      media.removeEventListener('loadedmetadata', seek);
      media.removeEventListener('loadeddata', seek);
      media.removeEventListener('canplay', seek);
    };
  }, [start, session.fileUrl]);
  const video = session.input.mime?.startsWith('video/'),
    audio = session.input.mime?.startsWith('audio/');
  function select(id: string) {
    setSelected(id);
  }
  return (
    <div className="study-sources">
      <aside aria-label="Source sections">
        <h2>Original material</h2>
        <p>{session.input.name}</p>
        {session.fileUrl && (
          <a href={session.fileUrl} download>
            Download original
          </a>
        )}
        {session.input.url && (
          <a href={session.input.url} target="_blank" rel="noreferrer">
            Open video on YouTube
          </a>
        )}
        <p className="muted">
          Original assets are retained until {new Date(session.assetExpiresAt).toLocaleString()}.
          Notes remain in your private workspace.
        </p>
        {session.sources.map((s) => (
          <button
            className={`study-source-row ${src?.id === s.id ? 'selected' : ''}`}
            key={s.id}
            aria-pressed={src?.id === s.id}
            onClick={() => select(s.id)}
          >
            {s.reference}
            {s.start != null && <span>{timestamp(s.start)}</span>}
          </button>
        ))}
      </aside>
      <section className="study-source-content">
        {video && session.fileUrl && (
          <video
            ref={player as React.RefObject<HTMLVideoElement>}
            src={session.fileUrl}
            controls
            preload="metadata"
          />
        )}
        {audio && session.fileUrl && (
          <audio
            ref={player as React.RefObject<HTMLAudioElement>}
            src={session.fileUrl}
            controls
            preload="metadata"
          />
        )}
        {session.input.kind === 'youtube' && session.input.videoId && session.input.embed && (
          <iframe
            title={session.input.name}
            src={`https://www.youtube-nocookie.com/embed/${session.input.videoId}${src?.start != null ? '?start=' + Math.floor(src.start) : ''}`}
            allow="fullscreen"
            referrerPolicy="strict-origin-when-cross-origin"
            loading="lazy"
          />
        )}
        {session.input.duration != null && <p>Duration: {timestamp(session.input.duration)}</p>}
        {src ? (
          <>
            <h2 ref={sourceHeading} tabIndex={-1} className="study-source-heading">
              {src.reference}
            </h2>
            {src.asset && (
              <img
                className="study-source-image"
                src={src.asset}
                alt={`Original ${src.reference}; extracted text follows`}
              />
            )}
            <h3>Extracted source content</h3>
            {src.text ? (
              <p className="study-source-text">{src.text}</p>
            ) : (
              <p className="muted">
                No text was extracted from this region. Check the original image.
              </p>
            )}
          </>
        ) : (
          <p>Source sections will appear after processing.</p>
        )}
        {session.analysis?.topics.length ? (
          <>
            <h3>Topics and source references</h3>
            <ul>
              {session.analysis.topics.map((t, i) => (
                <li key={i}>
                  {t.title}
                  <Citations ids={t.evidence} sources={session.sources} onSource={select} />
                </li>
              ))}
            </ul>
          </>
        ) : null}
      </section>
    </div>
  );
}
export function NotesView({
  initialStyle = 'detailed',
  analysis,
  sources,
  onChange,
  onSource,
  disabled,
}: {
  initialStyle?: 'detailed' | 'short' | 'exam';
  analysis: StudyAnalysis;
  sources: Source[];
  onChange: (a: StudyAnalysis) => void;
  onSource: (id: string) => void;
  disabled: boolean;
}) {
  const [style, setStyle] = useState<'detailed' | 'short' | 'exam'>(initialStyle),
    [editing, setEditing] = useState(false);
  return (
    <article className="study-notes">
      <div className="study-toolbar">
        <div className="mode-switch" role="group" aria-label="Notes format">
          {(['detailed', 'short', 'exam'] as const).map((s) => (
            <Button key={s} aria-pressed={style === s} onClick={() => setStyle(s)}>
              {s === 'exam' ? 'Exam notes' : s === 'short' ? 'Short notes' : 'Detailed notes'}
            </Button>
          ))}
        </div>
        <Button disabled={disabled} aria-pressed={editing} onClick={() => setEditing(!editing)}>
          {editing ? 'Finish editing' : 'Edit notes'}
        </Button>
      </div>
      <h2>{analysis.title}</h2>
      <p className="study-summary">{analysis.summary}</p>
      {analysis.notes[style].map((section, i) => (
        <section className="study-note-section" key={i}>
          <h3>{section.heading}</h3>
          {section.items.map((item, j) => (
            <div className="study-note-item" key={j}>
              {editing ? (
                <label>
                  Note {j + 1}
                  <textarea
                    value={item.text}
                    maxLength={4000}
                    rows={3}
                    onChange={(e) => {
                      const a = structuredClone(analysis);
                      a.notes[style][i].items[j].text = e.target.value;
                      onChange(a);
                    }}
                  />
                </label>
              ) : (
                <p>{item.text}</p>
              )}
              {item.origin !== 'source' && (
                <span className="badge warning">
                  {item.origin === 'additional'
                    ? 'Additional explanation'
                    : 'Uncertain interpretation'}
                </span>
              )}
              <Citations ids={item.evidence} sources={sources} onSource={onSource} />
            </div>
          ))}
        </section>
      ))}
      {analysis.tables.map((t, i) => (
        <section key={i}>
          <h3>{t.title}</h3>
          <div className="study-table-scroll">
            <table>
              <thead>
                <tr>
                  {t.columns.map((c, j) => (
                    <th scope="col" key={j}>
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {t.rows.map((r, j) => (
                  <tr key={j}>
                    {r.map((cell, k) => (
                      <td key={k}>{cell}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Citations ids={t.evidence} sources={sources} onSource={onSource} />
        </section>
      ))}
      {analysis.warnings.length > 0 && (
        <section className="notice">
          <h3>Source coverage and uncertainty</h3>
          <ul>
            {analysis.warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </section>
      )}
    </article>
  );
}
export function TutorView({
  session,
  onAsk,
  onSource,
  busy,
  enabled,
}: {
  session: LearningSession;
  onAsk: (q: string, diagram: boolean) => Promise<void>;
  onSource: (id: string) => void;
  busy: boolean;
  enabled: boolean;
}) {
  const [question, setQuestion] = useState(''),
    [diagram, setDiagram] = useState(false);
  async function submit() {
    const q = question.trim();
    if (!q) return;
    await onAsk(q, diagram);
    setQuestion('');
  }
  return (
    <section className="study-tutor">
      <h2>Ask about your material</h2>
      <p>
        Answers use this session’s sources and notes. Follow the references to check the
        explanation.
      </p>
      <div className="study-tutor-history" aria-live="polite">
        {session.chat.length === 0 && (
          <p className="muted">
            Try “Explain this in simpler terms”, “Walk me through the process” or “Give me a
            practice question”.
          </p>
        )}
        {session.chat.map((m) => (
          <article key={m.id} className="study-chat-message">
            <h3>Your question</h3>
            <p>{m.question}</p>
            <h3>Tutor response</h3>
            <p className="study-source-text">{m.result.answer}</p>
            {m.result.additionalExplanation && (
              <span className="badge warning">Includes additional explanation</span>
            )}
            {m.result.uncertain && <span className="badge warning">Needs source review</span>}
            <Citations ids={m.result.evidence} sources={session.sources} onSource={onSource} />
            {m.result.diagram && (
              <p>An additional {m.result.diagram.kind} diagram was saved to Diagrams.</p>
            )}
          </article>
        ))}
        {busy && <p role="status">The tutor is reviewing your sources…</p>}
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void submit().catch(() => undefined);
        }}
      >
        <label>
          Your question
          <textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            maxLength={2000}
            rows={3}
            required
            disabled={busy}
          />
        </label>
        <label className="study-consent">
          <input
            type="checkbox"
            checked={diagram}
            onChange={(e) => setDiagram(e.target.checked)}
            disabled={busy}
          />
          Include a new diagram when useful
        </label>
        <Button variant="primary" type="submit" disabled={!enabled || busy || !question.trim()}>
          {busy ? 'Thinking…' : 'Ask tutor'}
        </Button>
      </form>
    </section>
  );
}
export function RevisionView({
  session,
  onGenerate,
  onResult,
  onSource,
  busy,
  enabled,
}: {
  session: LearningSession;
  onGenerate: (count: number, difficulty: 'easy' | 'medium' | 'hard') => Promise<void>;
  onResult: (
    answers: Record<string, string>,
    settings?: { mode: 'practice' | 'timed'; timeLimitSeconds?: number; durationSeconds?: number },
  ) => Promise<void>;
  onSource: (id: string) => void;
  busy: boolean;
  enabled: boolean;
}) {
  const analysis = session.analysis!;
  const [view, setView] = useState<'cards' | 'quiz'>('cards'),
    [card, setCard] = useState(0),
    [revealed, setRevealed] = useState(false),
    [answers, setAnswers] = useState<Record<string, string>>({}),
    [submitted, setSubmitted] = useState(false),
    [count, setCount] = useState(session.options.questionCount),
    [difficulty, setDifficulty] = useState(session.options.difficulty),
    [mode, setMode] = useState<'practice' | 'timed'>('practice'),
    [minutes, setMinutes] = useState(10),
    [remaining, setRemaining] = useState(600),
    [deadline, setDeadline] = useState<number | null>(null),
    [started, setStarted] = useState(false);
  useEffect(() => {
    if (deadline == null || submitted) return;
    const tick = () => {
      const seconds = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      setRemaining(seconds);
      if (seconds === 0) setDeadline(null);
    };
    tick();
    const timer = setInterval(tick, 500);
    return () => clearInterval(timer);
  }, [deadline, submitted]);
  const locked = submitted || busy || (mode === 'timed' && (!started || remaining === 0));
  const lastAttempt = session.quizAttempts.at(-1);
  const missed = submitted ? (lastAttempt?.results?.filter((r) => r.correct === false) ?? []) : [];
  const revisitTopics = analysis.topics.filter((t) =>
    missed.some((r) => r.evidence.some((id) => t.evidence.includes(id))),
  );
  const current = analysis.flashcards[card % Math.max(1, analysis.flashcards.length)];
  return (
    <section className="study-revision">
      <h2>Revision and practice</h2>
      <div className="mode-switch" role="group" aria-label="Revision view">
        <Button aria-pressed={view === 'cards'} onClick={() => setView('cards')}>
          Flashcards
        </Button>
        <Button aria-pressed={view === 'quiz'} onClick={() => setView('quiz')}>
          Practice test
        </Button>
      </div>
      {view === 'cards' ? (
        current ? (
          <div className="study-flashcard">
            <p className="muted">
              Card {card + 1} of {analysis.flashcards.length}
            </p>
            <h3>{current.front}</h3>
            {revealed && (
              <>
                <p>{current.back}</p>
                <Citations ids={current.evidence} sources={session.sources} onSource={onSource} />
              </>
            )}
            <div className="study-toolbar">
              <Button aria-expanded={revealed} onClick={() => setRevealed(!revealed)}>
                {revealed ? 'Hide answer' : 'Reveal answer'}
              </Button>
              <Button
                onClick={() => {
                  setCard((card + 1) % analysis.flashcards.length);
                  setRevealed(false);
                }}
              >
                Next card
              </Button>
            </div>
          </div>
        ) : (
          <p>No flashcards were supported by this source.</p>
        )
      ) : (
        <>
          <div className="mode-switch" role="group" aria-label="Test mode">
            <Button
              aria-pressed={mode === 'practice'}
              disabled={started && !submitted}
              onClick={() => setMode('practice')}
            >
              Untimed quiz
            </Button>
            <Button
              aria-pressed={mode === 'timed'}
              disabled={started && !submitted}
              onClick={() => setMode('timed')}
            >
              Timed test
            </Button>
          </div>
          {mode === 'timed' && (
            <section className="notice">
              <h3>Exam practice timer</h3>
              <label>
                Time limit (minutes)
                <input
                  type="number"
                  min={1}
                  max={120}
                  disabled={started}
                  value={minutes}
                  onChange={(e) => setMinutes(Math.max(1, Math.min(120, Number(e.target.value))))}
                />
              </label>
              <p role="timer" aria-live="off">
                Time remaining: {timestamp(remaining)}
              </p>
              <div className="study-toolbar">
                {!started && (
                  <Button
                    disabled={busy}
                    onClick={() => {
                      setAnswers({});
                      setSubmitted(false);
                      setStarted(true);
                      setRemaining(minutes * 60);
                      setDeadline(Date.now() + minutes * 60000);
                    }}
                  >
                    Start timed test
                  </Button>
                )}
                {started && remaining > 0 && !submitted && (
                  <Button
                    disabled={busy}
                    onClick={() =>
                      setDeadline(deadline === null ? Date.now() + remaining * 1000 : null)
                    }
                  >
                    {deadline === null ? 'Resume timer' : 'Pause timer'}
                  </Button>
                )}
                {started && (
                  <Button
                    disabled={busy}
                    onClick={() => {
                      setStarted(false);
                      setDeadline(null);
                      setRemaining(minutes * 60);
                      setSubmitted(false);
                      setAnswers({});
                    }}
                  >
                    Reset timed test
                  </Button>
                )}
              </div>
              {started && remaining === 0 && !submitted && (
                <p role="status">
                  Time is up. Submit your answers; unanswered choice questions count as incorrect.
                </p>
              )}
              <p className="muted">
                The timer is optional and can be paused. It resets when you leave this workspace.
                This is self-paced practice.
              </p>
            </section>
          )}
          <form
            className="study-practice-settings"
            onSubmit={(e) => {
              e.preventDefault();
              void onGenerate(count, difficulty)
                .then(() => {
                  setAnswers({});
                  setSubmitted(false);
                })
                .catch(() => undefined);
            }}
          >
            <label>
              Difficulty
              <select
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value as typeof difficulty)}
              >
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
              </select>
            </label>
            <label>
              Questions
              <input
                type="number"
                min={1}
                max={20}
                value={count}
                onChange={(e) => setCount(Math.max(1, Math.min(20, Number(e.target.value))))}
              />
            </label>
            <Button type="submit" disabled={busy || !enabled || (started && !submitted)}>
              {busy ? 'Generating…' : 'Generate new test'}
            </Button>
          </form>
          <p className="muted">
            Choice answers are checked automatically. Written responses need your own review against
            the explanation.
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void onResult(
                answers,
                mode === 'timed'
                  ? {
                      mode,
                      timeLimitSeconds: minutes * 60,
                      durationSeconds: minutes * 60 - remaining,
                    }
                  : { mode },
              )
                .then(() => setSubmitted(true))
                .catch(() => undefined);
            }}
          >
            {analysis.questions.map((q, i) => (
              <fieldset key={q.id} className="study-question">
                <legend>
                  {i + 1}. {q.prompt}
                </legend>
                <p className="muted">
                  {q.kind} · {q.difficulty}
                </p>
                {q.options.length ? (
                  q.options.map((o, j) => (
                    <label key={j} className="study-choice">
                      <input
                        type="radio"
                        name={q.id}
                        value={o}
                        required={mode === 'practice'}
                        checked={answers[q.id] === o}
                        disabled={locked}
                        onChange={() => setAnswers({ ...answers, [q.id]: o })}
                      />
                      {o}
                    </label>
                  ))
                ) : (
                  <label>
                    Your answer
                    <textarea
                      required={mode === 'practice'}
                      value={answers[q.id] ?? ''}
                      maxLength={4000}
                      disabled={locked}
                      rows={3}
                      onChange={(e) => setAnswers({ ...answers, [q.id]: e.target.value })}
                    />
                  </label>
                )}
                {submitted && (
                  <div className="notice">
                    <strong>
                      {q.options.length
                        ? answers[q.id] === q.answer
                          ? 'Correct'
                          : 'Review this answer'
                        : 'Compare your response'}
                    </strong>
                    <p>Answer: {q.answer}</p>
                    <p>{q.explanation}</p>
                    <Citations ids={q.evidence} sources={session.sources} onSource={onSource} />
                  </div>
                )}
              </fieldset>
            ))}
            {analysis.questions.length > 0 && (
              <Button
                variant="primary"
                type="submit"
                disabled={submitted || busy || (mode === 'timed' && !started)}
              >
                Check answers and save attempt
              </Button>
            )}
            {submitted && (
              <Button
                onClick={() => {
                  setAnswers({});
                  setSubmitted(false);
                  setStarted(false);
                  setDeadline(null);
                }}
              >
                Try again
              </Button>
            )}
          </form>
          {submitted && missed.length > 0 && (
            <section className="notice">
              <h3>What to revise next</h3>
              {revisitTopics.length > 0 && (
                <p>Revisit: {revisitTopics.map((t) => t.title).join(', ')}.</p>
              )}
              {missed.map((r) => (
                <article key={r.questionId}>
                  <h4>{r.prompt}</h4>
                  <p>{r.explanation}</p>
                  <Citations ids={r.evidence} sources={session.sources} onSource={onSource} />
                </article>
              ))}
            </section>
          )}
        </>
      )}
      {session.quizAttempts.length > 0 && (
        <section>
          <h3>Saved attempts</h3>
          <ul>
            {session.quizAttempts
              .slice(-10)
              .reverse()
              .map((a) => (
                <li key={a.id}>
                  {new Date(a.createdAt).toLocaleString()} · {a.correct}/{a.total} automatically
                  checked answers correct
                  {a.mode === 'timed' && ' · Timed practice'}
                </li>
              ))}
          </ul>
        </section>
      )}
    </section>
  );
}
