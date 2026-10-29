import { DatabaseSync } from 'node:sqlite'
import type { AnswerEvent, KnowledgeDoc, Profile, QuestionEvent, ResumableSession, SessionSummary, Source, TranscriptSegment } from '@shared/types'
import type { Chunk } from '../context/retrieval'

const MIGRATIONS: string[] = [
  `CREATE TABLE sessions(id TEXT PRIMARY KEY, started_at INTEGER NOT NULL, ended_at INTEGER, status TEXT NOT NULL,
     profile_id TEXT, mode TEXT, title TEXT);
   CREATE TABLE transcript_segments(id TEXT PRIMARY KEY, session_id TEXT NOT NULL, source TEXT NOT NULL,
     start_ms INTEGER, end_ms INTEGER, text TEXT NOT NULL, lang TEXT);
   CREATE INDEX ix_seg_session ON transcript_segments(session_id, start_ms);
   CREATE TABLE questions(id TEXT NOT NULL, revision INTEGER NOT NULL, session_id TEXT NOT NULL, source TEXT, text TEXT,
     kind TEXT, status TEXT, trigger TEXT, start_ms INTEGER, end_ms INTEGER, supersedes TEXT, created_at INTEGER,
     PRIMARY KEY(id, revision));
   CREATE INDEX ix_q_session ON questions(session_id);
   CREATE TABLE answers(id TEXT PRIMARY KEY, session_id TEXT NOT NULL, question_id TEXT, revision INTEGER, kind TEXT,
     provider TEXT, model TEXT, preset TEXT, text TEXT, status TEXT, first_token_ms INTEGER, latency_ms INTEGER,
     input_tokens INTEGER, output_tokens INTEGER, cost_usd REAL, created_at INTEGER);
   CREATE INDEX ix_a_session ON answers(session_id);
   CREATE INDEX ix_a_question ON answers(question_id);
   CREATE TABLE profiles(id TEXT PRIMARY KEY, name TEXT NOT NULL, preset TEXT NOT NULL, style TEXT NOT NULL, notes TEXT NOT NULL DEFAULT '');
   CREATE TABLE knowledge_documents(id TEXT PRIMARY KEY, profile_id TEXT NOT NULL, name TEXT NOT NULL, kind TEXT NOT NULL, created_at INTEGER);
   CREATE TABLE knowledge_chunks(id TEXT PRIMARY KEY, document_id TEXT NOT NULL, ord INTEGER, section TEXT, text TEXT NOT NULL,
     trust TEXT NOT NULL DEFAULT 'user_provided');
   CREATE INDEX ix_chunk_doc ON knowledge_chunks(document_id);
   CREATE TABLE usage_events(id TEXT PRIMARY KEY, session_id TEXT, provider TEXT, model TEXT, at INTEGER,
     input_tokens INTEGER, output_tokens INTEGER, cost_usd REAL);
   CREATE INDEX ix_usage_at ON usage_events(at);
   CREATE TABLE app_diagnostics(id INTEGER PRIMARY KEY AUTOINCREMENT, at INTEGER, kind TEXT, data TEXT);`
]

type Row = Record<string, unknown>

export class Db {
  readonly sql: DatabaseSync

  constructor(path: string) {
    this.sql = new DatabaseSync(path)
    this.sql.exec('PRAGMA journal_mode=WAL; PRAGMA synchronous=NORMAL; PRAGMA foreign_keys=ON; PRAGMA secure_delete=ON;')
    this.migrate()
  }

  private migrate(): void {
    this.sql.exec('CREATE TABLE IF NOT EXISTS schema_version(version INTEGER NOT NULL)')
    const row = this.sql.prepare('SELECT MAX(version) AS v FROM schema_version').get() as { v: number | null }
    let v = row.v ?? 0
    while (v < MIGRATIONS.length) {
      this.tx(() => {
        this.sql.exec(MIGRATIONS[v])
        this.sql.prepare('INSERT INTO schema_version(version) VALUES (?)').run(v + 1)
      })
      v++
    }
  }

  tx<T>(fn: () => T): T {
    this.sql.exec('BEGIN')
    try {
      const r = fn()
      this.sql.exec('COMMIT')
      return r
    } catch (e) {
      this.sql.exec('ROLLBACK')
      throw e
    }
  }

  close(): void {
    this.sql.close()
  }

  /** I mark sessions left 'active' by a crash as 'interrupted'; their transcript is already on disk (WAL). */
  recoverInterrupted(): number {
    return Number(this.sql.prepare("UPDATE sessions SET status='interrupted', ended_at=COALESCE(ended_at, ?) WHERE status='active'").run(Date.now()).changes)
  }

  startSession(id: string, profileId: string, mode: string, title: string): void {
    this.sql
      .prepare("INSERT INTO sessions(id, started_at, status, profile_id, mode, title) VALUES (?,?,'active',?,?,?)")
      .run(id, Date.now(), profileId, mode, title)
  }

  endSession(id: string): void {
    this.sql.prepare("UPDATE sessions SET status='ended', ended_at=? WHERE id=?").run(Date.now(), id)
  }

  setSessionTitle(id: string, title: string): void {
    this.sql.prepare('UPDATE sessions SET title=? WHERE id=?').run(title, id)
  }

  addSegment(s: TranscriptSegment): void {
    this.sql
      .prepare('INSERT OR REPLACE INTO transcript_segments(id, session_id, source, start_ms, end_ms, text, lang) VALUES (?,?,?,?,?,?,?)')
      .run(s.segmentId, s.sessionId, s.source, s.startMs, s.endMs, s.text, s.lang)
  }

  upsertQuestion(q: QuestionEvent): void {
    this.sql
      .prepare(
        `INSERT OR REPLACE INTO questions(id, revision, session_id, source, text, kind, status, trigger, start_ms, end_ms, supersedes, created_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`
      )
      .run(q.questionId, q.revision, q.sessionId, q.source, q.text, q.kind, q.status, q.trigger, q.startMs, q.endMs, q.supersedes, Date.now())
  }

  upsertAnswer(a: AnswerEvent): void {
    this.sql
      .prepare(
        `INSERT OR REPLACE INTO answers(id, session_id, question_id, revision, kind, provider, model, preset, text, status,
           first_token_ms, latency_ms, input_tokens, output_tokens, cost_usd, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
      )
      .run(
        a.answerId,
        a.sessionId,
        a.questionId,
        a.revision,
        a.kind,
        a.provider,
        a.model,
        a.promptPreset,
        a.text,
        a.status,
        a.firstTokenMs,
        a.latencyMs,
        a.usage?.inputTokens ?? null,
        a.usage?.outputTokens ?? null,
        a.usageCostUsd,
        Date.now()
      )
  }

  addUsage(id: string, sessionId: string | null, provider: string, model: string, input: number, output: number, cost: number | null): void {
    this.sql
      .prepare('INSERT INTO usage_events(id, session_id, provider, model, at, input_tokens, output_tokens, cost_usd) VALUES (?,?,?,?,?,?,?,?)')
      .run(id, sessionId, provider, model, Date.now(), input, output, cost)
  }

  spentSince(ts: number): number {
    const r = this.sql.prepare('SELECT COALESCE(SUM(cost_usd),0) AS s FROM usage_events WHERE at >= ?').get(ts) as { s: number }
    return r.s
  }

  listSessions(query?: string, limit = 50): SessionSummary[] {
    const q = query?.trim()
    const rows = (
      q
        ? this.sql
            .prepare(
              `SELECT s.*, (SELECT COUNT(DISTINCT id) FROM questions WHERE session_id=s.id) AS qn FROM sessions s
             WHERE s.title LIKE ? OR EXISTS (SELECT 1 FROM transcript_segments t WHERE t.session_id=s.id AND t.text LIKE ?)
             ORDER BY started_at DESC LIMIT ?`
            )
            .all(`%${q}%`, `%${q}%`, limit)
        : this.sql
            .prepare('SELECT s.*, (SELECT COUNT(DISTINCT id) FROM questions WHERE session_id=s.id) AS qn FROM sessions s ORDER BY started_at DESC LIMIT ?')
            .all(limit)
    ) as Row[]
    return rows.map((r) => ({
      id: String(r.id),
      startedAt: Number(r.started_at),
      endedAt: r.ended_at == null ? null : Number(r.ended_at),
      status: r.status as SessionSummary['status'],
      title: String(r.title ?? ''),
      questions: Number(r.qn ?? 0)
    }))
  }

  sessionDetail(id: string): { session: Row | undefined; segments: Row[]; questions: Row[]; answers: Row[] } {
    return {
      session: this.sql.prepare('SELECT * FROM sessions WHERE id=?').get(id) as Row | undefined,
      segments: this.sql.prepare('SELECT * FROM transcript_segments WHERE session_id=? ORDER BY start_ms').all(id) as Row[],
      questions: this.sql.prepare('SELECT * FROM questions WHERE session_id=? ORDER BY created_at, revision').all(id) as Row[],
      answers: this.sql.prepare("SELECT * FROM answers WHERE session_id=? AND status IN ('done','error','cancelled') ORDER BY created_at").all(id) as Row[]
    }
  }

  /** The most recent finished session that has any transcript — the one "Continue previous session" picks up. */
  lastResumable(): ResumableSession | null {
    const r = this.sql
      .prepare(
        `SELECT s.*, (SELECT COUNT(*) FROM transcript_segments t WHERE t.session_id=s.id) AS segs
         FROM sessions s WHERE s.status!='active' ORDER BY COALESCE(s.ended_at, s.started_at) DESC LIMIT 1`
      )
      .get() as Row | undefined
    if (!r || Number(r.segs) === 0) return null
    return {
      id: String(r.id),
      title: String(r.title ?? ''),
      startedAt: Number(r.started_at),
      endedAt: r.ended_at == null ? null : Number(r.ended_at),
      mode: (String(r.mode ?? 'live') as ResumableSession['mode']) || 'live',
      interrupted: r.status === 'interrupted',
      segments: Number(r.segs)
    }
  }

  sessionSegments(id: string): TranscriptSegment[] {
    return (this.sql.prepare('SELECT * FROM transcript_segments WHERE session_id=? ORDER BY start_ms').all(id) as Row[]).map((r) => ({
      sessionId: String(r.session_id),
      segmentId: String(r.id),
      source: r.source as Source,
      startMs: Number(r.start_ms),
      endMs: Number(r.end_ms),
      text: String(r.text),
      isFinal: true,
      lang: r.lang == null ? null : String(r.lang)
    }))
  }

  deleteSession(id: string): void {
    this.tx(() => {
      for (const t of ['transcript_segments', 'questions', 'answers', 'usage_events']) {
        this.sql.prepare(`DELETE FROM ${t} WHERE session_id=?`).run(id)
      }
      this.sql.prepare('DELETE FROM sessions WHERE id=?').run(id)
    })
    this.purgeWal()
  }

  deleteAllHistory(): void {
    this.tx(() => {
      for (const t of ['transcript_segments', 'questions', 'answers', 'usage_events', 'sessions', 'app_diagnostics']) {
        this.sql.exec(`DELETE FROM ${t}`)
      }
    })
    this.sql.exec('VACUUM')
    this.purgeWal()
  }

  // secure_delete zeroes freed pages in the main file, but the WAL still holds the old page images until checkpointed.
  private purgeWal(): void {
    this.sql.exec('PRAGMA wal_checkpoint(TRUNCATE)')
  }

  listProfiles(): Profile[] {
    return (this.sql.prepare('SELECT * FROM profiles ORDER BY name').all() as Row[]).map((r) => ({
      id: String(r.id),
      name: String(r.name),
      preset: r.preset as Profile['preset'],
      style: r.style as Profile['style'],
      notes: String(r.notes ?? '')
    }))
  }

  upsertProfile(p: Profile): void {
    this.sql.prepare('INSERT OR REPLACE INTO profiles(id, name, preset, style, notes) VALUES (?,?,?,?,?)').run(p.id, p.name, p.preset, p.style, p.notes)
  }

  deleteProfile(id: string): void {
    this.tx(() => {
      for (const d of this.listDocs(id)) this.deleteDocInner(d.id)
      this.sql.prepare('DELETE FROM profiles WHERE id=?').run(id)
    })
  }

  addDocument(doc: { id: string; profileId: string; name: string; kind: KnowledgeDoc['kind'] }, chunks: { id: string; section: string; text: string }[]): void {
    this.tx(() => {
      this.sql
        .prepare('INSERT INTO knowledge_documents(id, profile_id, name, kind, created_at) VALUES (?,?,?,?,?)')
        .run(doc.id, doc.profileId, doc.name, doc.kind, Date.now())
      const ins = this.sql.prepare("INSERT INTO knowledge_chunks(id, document_id, ord, section, text, trust) VALUES (?,?,?,?,?,'user_provided')")
      chunks.forEach((c, i) => ins.run(c.id, doc.id, i, c.section, c.text))
    })
  }

  listDocs(profileId: string): KnowledgeDoc[] {
    return (
      this.sql
        .prepare(
          'SELECT d.*, (SELECT COUNT(*) FROM knowledge_chunks c WHERE c.document_id=d.id) AS n FROM knowledge_documents d WHERE profile_id=? ORDER BY created_at'
        )
        .all(profileId) as Row[]
    ).map((r) => ({
      id: String(r.id),
      profileId: String(r.profile_id),
      name: String(r.name),
      kind: r.kind as KnowledgeDoc['kind'],
      chunks: Number(r.n),
      createdAt: Number(r.created_at)
    }))
  }

  chunksForProfile(profileId: string): Chunk[] {
    return (
      this.sql
        .prepare(
          'SELECT c.*, d.name AS doc_name, d.kind AS doc_kind FROM knowledge_chunks c JOIN knowledge_documents d ON d.id=c.document_id WHERE d.profile_id=? ORDER BY d.created_at, c.ord'
        )
        .all(profileId) as Row[]
    ).map((r) => ({
      id: String(r.id),
      documentId: String(r.document_id),
      docName: String(r.doc_name),
      kind: r.doc_kind as Chunk['kind'],
      section: String(r.section ?? ''),
      text: String(r.text)
    }))
  }

  deleteDoc(id: string): void {
    this.tx(() => this.deleteDocInner(id))
  }

  private deleteDocInner(id: string): void {
    this.sql.prepare('DELETE FROM knowledge_chunks WHERE document_id=?').run(id)
    this.sql.prepare('DELETE FROM knowledge_documents WHERE id=?').run(id)
  }

  logDiag(kind: string, data: unknown): void {
    this.sql.prepare('INSERT INTO app_diagnostics(at, kind, data) VALUES (?,?,?)').run(Date.now(), kind, JSON.stringify(data))
    this.sql.prepare('DELETE FROM app_diagnostics WHERE id <= (SELECT MAX(id) - 2000 FROM app_diagnostics)').run()
  }

  recentDiag(limit = 200): { at: number; kind: string; data: string }[] {
    return this.sql.prepare('SELECT at, kind, data FROM app_diagnostics ORDER BY id DESC LIMIT ?').all(limit) as { at: number; kind: string; data: string }[]
  }
}
