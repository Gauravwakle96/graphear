import { randomUUID } from 'node:crypto';
import type { Store } from '../store';
import type { Source, StudyAnalysis, StudyOptions, TutorAnswer } from '@graphear/core';
export type LearningInput = {
  kind: 'file' | 'text' | 'youtube';
  name: string;
  mime: string | null;
  path: string | null;
  text: string;
  url: string | null;
  videoId: string | null;
  duration: number | null;
  embed: boolean;
};
export type LearningStatus =
  'draft' | 'queued' | 'extracting' | 'generating' | 'completed' | 'failed' | 'cancelled';
export type ChatMessage = { id: string; question: string; result: TutorAnswer; createdAt: string };
export type QuizAttempt = {
  id: string;
  createdAt: string;
  correct: number;
  total: number;
  answers: Record<string, string>;
};
export type LearningSession = {
  id: string;
  owner: string;
  title: string;
  input: LearningInput;
  options: StudyOptions;
  sources: Source[];
  analysis: StudyAnalysis | null;
  chat: ChatMessage[];
  quizAttempts: QuizAttempt[];
  status: LearningStatus;
  progress: number;
  message: string;
  error: string | null;
  revision: number;
  createdAt: string;
  updatedAt: string;
  assetExpiresAt: number;
};
export class LearningStore {
  constructor(private base: Store) {
    base.db
      .exec(`CREATE TABLE IF NOT EXISTS learning_sessions(id TEXT PRIMARY KEY,owner TEXT NOT NULL REFERENCES sessions(hash),title TEXT NOT NULL,payload TEXT NOT NULL,status TEXT NOT NULL,progress INTEGER NOT NULL,message TEXT NOT NULL,error TEXT,revision INTEGER NOT NULL,created TEXT NOT NULL,updated TEXT NOT NULL,expires INTEGER NOT NULL);
 CREATE INDEX IF NOT EXISTS learning_owner ON learning_sessions(owner);
 CREATE TABLE IF NOT EXISTS learning_calls(id INTEGER PRIMARY KEY,day TEXT NOT NULL,owner TEXT NOT NULL,session TEXT NOT NULL,task TEXT NOT NULL);
 CREATE INDEX IF NOT EXISTS learning_call_day ON learning_calls(day);`);
    base.db.exec(
      'CREATE TABLE IF NOT EXISTS ai_provider_cooldowns(key TEXT PRIMARY KEY,retry_at INTEGER NOT NULL,daily_quota INTEGER NOT NULL,free_tier INTEGER NOT NULL);',
    );
  }
  cooldown(key: string) {
    const row = this.base.db
      .prepare('SELECT * FROM ai_provider_cooldowns WHERE key=? AND retry_at>?')
      .get(key, Date.now());
    return row
      ? {
          retryAt: Number(row.retry_at),
          dailyQuota: Boolean(row.daily_quota),
          freeTier: Boolean(row.free_tier),
        }
      : null;
  }
  blockProvider(key: string, state: { retryAt: number; dailyQuota: boolean; freeTier: boolean }) {
    this.base.db
      .prepare(
        `INSERT INTO ai_provider_cooldowns VALUES(?,?,?,?) ON CONFLICT(key) DO UPDATE SET
          daily_quota=CASE WHEN excluded.retry_at>=retry_at THEN excluded.daily_quota ELSE daily_quota END,
          free_tier=CASE WHEN excluded.retry_at>=retry_at THEN excluded.free_tier ELSE free_tier END,
          retry_at=MAX(retry_at,excluded.retry_at)`,
      )
      .run(key, state.retryAt, Number(state.dailyQuota), Number(state.freeTier));
  }
  create(
    owner: string,
    input: LearningInput,
    options: StudyOptions,
    retentionHours: number,
    queued: boolean,
  ) {
    const id = randomUUID(),
      now = new Date().toISOString();
    const payload = { input, options, sources: [], analysis: null, chat: [], quizAttempts: [] };
    this.base.db
      .prepare('INSERT INTO learning_sessions VALUES(?,?,?,?,?,?,?,?,1,?,?,?)')
      .run(
        id,
        owner,
        input.name.slice(0, 180) || 'Learning session',
        JSON.stringify(payload),
        queued ? 'queued' : 'draft',
        0,
        queued ? 'Waiting for processing' : 'Source saved; processing has not started',
        null,
        now,
        now,
        Date.now() + retentionHours * 3600_000,
      );
    return this.get(owner, id)!;
  }
  get(owner: string, id: string) {
    const row = this.base.db
      .prepare('SELECT * FROM learning_sessions WHERE owner=? AND id=?')
      .get(owner, id);
    return row ? this.read(row) : null;
  }
  private read(r: Record<string, unknown>): LearningSession {
    return {
      id: String(r.id),
      owner: String(r.owner),
      title: String(r.title),
      ...(JSON.parse(String(r.payload)) as Pick<
        LearningSession,
        'input' | 'options' | 'sources' | 'analysis' | 'chat'
      >),
      quizAttempts:
        (JSON.parse(String(r.payload)) as { quizAttempts?: QuizAttempt[] }).quizAttempts ?? [],
      status: String(r.status) as LearningStatus,
      progress: Number(r.progress),
      message: String(r.message),
      error: r.error ? String(r.error) : null,
      revision: Number(r.revision),
      createdAt: String(r.created),
      updatedAt: String(r.updated),
      assetExpiresAt: Number(r.expires),
    };
  }
  list(owner: string) {
    return this.base.db
      .prepare('SELECT * FROM learning_sessions WHERE owner=? ORDER BY updated DESC LIMIT 100')
      .all(owner)
      .map((r) => this.read(r));
  }
  write(s: LearningSession, expected?: number) {
    const payload = {
      input: s.input,
      options: s.options,
      sources: s.sources,
      analysis: s.analysis,
      chat: s.chat,
      quizAttempts: s.quizAttempts,
    };
    const result = this.base.db
      .prepare(
        'UPDATE learning_sessions SET title=?,payload=?,status=?,progress=?,message=?,error=?,revision=revision+1,updated=? WHERE id=? AND owner=? AND revision=?',
      )
      .run(
        s.title,
        JSON.stringify(payload),
        s.status,
        s.progress,
        s.message,
        s.error,
        new Date().toISOString(),
        s.id,
        s.owner,
        expected ?? s.revision,
      );
    return Number(result.changes) > 0 ? this.get(s.owner, s.id) : null;
  }
  state(
    owner: string,
    id: string,
    status: LearningStatus,
    progress: number,
    message: string,
    error: string | null = null,
  ) {
    this.base.db
      .prepare(
        'UPDATE learning_sessions SET status=?,progress=?,message=?,error=?,updated=? WHERE id=? AND owner=?',
      )
      .run(status, progress, message, error, new Date().toISOString(), id, owner);
  }
  claim() {
    const row = this.base.db
      .prepare(
        "UPDATE learning_sessions SET status='extracting',progress=3,message='Reading source material' WHERE id=(SELECT id FROM learning_sessions WHERE status='queued' ORDER BY created LIMIT 1) AND status='queued' RETURNING *",
      )
      .get();
    return row ? this.read(row) : null;
  }
  recover() {
    this.base.db
      .prepare(
        "UPDATE learning_sessions SET status='failed',error='Processing was interrupted. Retry explicitly to avoid unexpected duplicate AI charges.',message='Processing interrupted' WHERE status IN ('extracting','generating')",
      )
      .run();
  }
  reserve(owner: string, session: string, task: string, dailyLimit: number, jobLimit: number) {
    const day = new Date().toISOString().slice(0, 10);
    this.base.db.exec('BEGIN IMMEDIATE');
    try {
      const total = Number(
        this.base.db.prepare('SELECT COUNT(*) AS n FROM learning_calls WHERE day=?').get(day)?.n ??
          0,
      );
      const user = Number(
        this.base.db
          .prepare('SELECT COUNT(*) AS n FROM learning_calls WHERE day=? AND owner=?')
          .get(day, owner)?.n ?? 0,
      );
      const job = Number(
        this.base.db
          .prepare(
            "SELECT COUNT(*) AS n FROM learning_calls WHERE session=? AND task IN ('analysis','ocr','transcription')",
          )
          .get(session)?.n ?? 0,
      );
      if (
        total >= dailyLimit ||
        user >= Math.min(25, dailyLimit) ||
        (['analysis', 'ocr', 'transcription'].includes(task) && job >= jobLimit)
      )
        throw new Error(
          'AI call budget reached. Increase the configured limit or try another day.',
        );
      this.base.db
        .prepare('INSERT INTO learning_calls(day,owner,session,task) VALUES(?,?,?,?)')
        .run(day, owner, session, task);
      this.base.db.exec('COMMIT');
    } catch (e) {
      this.base.db.exec('ROLLBACK');
      throw e;
    }
  }
  delete(owner: string, id: string) {
    return (
      Number(
        this.base.db.prepare('DELETE FROM learning_sessions WHERE owner=? AND id=?').run(owner, id)
          .changes,
      ) > 0
    );
  }
  expired(now: number) {
    return this.base.db
      .prepare(
        "SELECT * FROM learning_sessions WHERE expires<? AND status NOT IN ('extracting','generating')",
      )
      .all(now)
      .map((r) => this.read(r));
  }
}
export function publicLearning(s: LearningSession) {
  const { owner: _owner, ...record } = s;
  void _owner;
  return {
    ...record,
    input: { ...record.input, path: undefined },
    sources: record.sources.map((src) => ({
      ...src,
      asset: src.asset ? `/api/learning/${s.id}/sources/${src.id}` : null,
    })),
    hasFile: Boolean(s.input.path),
    fileUrl: s.input.path ? `/api/learning/${s.id}/file` : null,
  };
}
