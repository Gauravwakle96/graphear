import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { randomUUID } from 'node:crypto';
import type { Graph } from '@graphear/core';

export type Project = {
  id: string;
  owner: string;
  graph: Graph;
  revision: number;
  updatedAt: string;
  shareToken?: string;
};
export class Store {
  readonly db: DatabaseSync;
  constructor(path: string) {
    if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
    this.db = new DatabaseSync(path);
    this.db.exec(`PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;
 CREATE TABLE IF NOT EXISTS sessions(hash TEXT PRIMARY KEY,csrf TEXT NOT NULL,expires INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS projects(id TEXT PRIMARY KEY,owner TEXT NOT NULL REFERENCES sessions(hash),graph TEXT NOT NULL,revision INTEGER NOT NULL,updated TEXT NOT NULL);
 CREATE INDEX IF NOT EXISTS projects_owner ON projects(owner);
 CREATE TABLE IF NOT EXISTS shares(token TEXT PRIMARY KEY,project TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,owner TEXT NOT NULL,graph TEXT NOT NULL,created TEXT NOT NULL);
 CREATE UNIQUE INDEX IF NOT EXISTS shares_project ON shares(project);
 CREATE TABLE IF NOT EXISTS rate_limits(key TEXT PRIMARY KEY,bucket INTEGER NOT NULL,hits INTEGER NOT NULL);`);
  }
  close() {
    this.db.close();
  }
  session(hash: string) {
    const row = this.db.prepare('SELECT csrf,expires FROM sessions WHERE hash=?').get(hash);
    if (!row || Number(row.expires) < Date.now()) return null;
    return { csrf: String(row.csrf), expires: Number(row.expires) };
  }
  createSession(hash: string, csrf: string) {
    this.db
      .prepare('INSERT INTO sessions(hash,csrf,expires) VALUES(?,?,?)')
      .run(hash, csrf, Date.now() + 30 * 24 * 60 * 60 * 1000);
  }
  rate(key: string) {
    const bucket = Math.floor(Date.now() / 60_000);
    this.db.prepare('DELETE FROM rate_limits WHERE bucket<?').run(bucket - 2);
    const row = this.db
      .prepare(
        'INSERT INTO rate_limits(key,bucket,hits) VALUES(?,?,1) ON CONFLICT(key) DO UPDATE SET hits=CASE WHEN bucket=excluded.bucket THEN hits+1 ELSE 1 END,bucket=excluded.bucket RETURNING hits',
      )
      .get(key, bucket);
    return Number(row?.hits ?? 0);
  }
  list(owner: string) {
    return this.db
      .prepare(
        'SELECT p.*,s.token AS shareToken FROM projects p LEFT JOIN shares s ON s.project=p.id WHERE p.owner=? ORDER BY p.updated DESC LIMIT 50',
      )
      .all(owner)
      .map((row) => this.project(row));
  }
  get(owner: string, id: string) {
    const row = this.db
      .prepare(
        'SELECT p.*,s.token AS shareToken FROM projects p LEFT JOIN shares s ON s.project=p.id WHERE p.owner=? AND p.id=?',
      )
      .get(owner, id);
    return row ? this.project(row) : null;
  }
  private project(row: Record<string, unknown>): Project {
    return {
      id: String(row.id),
      owner: String(row.owner),
      graph: JSON.parse(String(row.graph)) as Graph,
      revision: Number(row.revision),
      updatedAt: String(row.updated),
      ...(row.shareToken ? { shareToken: String(row.shareToken) } : {}),
    };
  }
  create(owner: string, graph: Graph) {
    const id = randomUUID();
    const updatedAt = new Date().toISOString();
    this.db
      .prepare('INSERT INTO projects(id,owner,graph,revision,updated) VALUES(?,?,?,1,?)')
      .run(id, owner, JSON.stringify(graph), updatedAt);
    return this.get(owner, id)!;
  }
  update(owner: string, id: string, graph: Graph, revision: number) {
    const result = this.db
      .prepare(
        'UPDATE projects SET graph=?,revision=revision+1,updated=? WHERE id=? AND owner=? AND revision=?',
      )
      .run(JSON.stringify(graph), new Date().toISOString(), id, owner, revision);
    return Number(result.changes) > 0 ? this.get(owner, id) : null;
  }
  delete(owner: string, id: string) {
    return (
      Number(
        this.db.prepare('DELETE FROM projects WHERE id=? AND owner=?').run(id, owner).changes,
      ) > 0
    );
  }
  publish(owner: string, id: string, token: string) {
    const project = this.get(owner, id);
    if (!project) return null;
    this.db
      .prepare(
        'INSERT INTO shares(token,project,owner,graph,created) VALUES(?,?,?,?,?) ON CONFLICT(project) DO UPDATE SET token=excluded.token,graph=excluded.graph,created=excluded.created',
      )
      .run(token, id, owner, JSON.stringify(project.graph), new Date().toISOString());
    return token;
  }
  revoke(owner: string, id: string) {
    this.db.prepare('DELETE FROM shares WHERE owner=? AND project=?').run(owner, id);
  }
  shared(token: string) {
    const row = this.db.prepare('SELECT graph,created FROM shares WHERE token=?').get(token);
    return row
      ? { graph: JSON.parse(String(row.graph)) as Graph, publishedAt: String(row.created) }
      : null;
  }
}
