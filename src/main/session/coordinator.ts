import type { Candidate, QuestionEvent, QuestionTrigger, Source, UtteranceKind } from '@shared/types'
import { classify, isExpandRequest, similarity } from './detector'

export interface Utterance {
  source: Source
  text: string
  startMs: number
  endMs: number
}

export type Decision =
  | { type: 'ignore'; reason: string }
  | { type: 'candidate'; candidate: Candidate }
  | { type: 'new'; question: QuestionEvent; superseded: QuestionEvent | null }
  | { type: 'revise'; question: QuestionEvent }
  | { type: 'duplicate'; of: string }
  | { type: 'reanswer'; question: QuestionEvent }
  | { type: 'expand'; question: QuestionEvent }

export interface CoordinatorOptions {
  /** Practice mode: the user reads questions aloud themselves. */
  answerUserSource: boolean
  dupWindowMs: number
  dupThreshold: number
  /** A question split by VAD into several utterances: gap below this merges them. */
  continuationGapMs: number
  followUpWindowMs: number
}

export const DEFAULT_COORDINATOR: CoordinatorOptions = {
  answerUserSource: false,
  dupWindowMs: 20_000,
  dupThreshold: 0.85,
  continuationGapMs: 3_500,
  followUpWindowMs: 30_000
}

interface Tracked extends Utterance {
  consumed: boolean
  /** Own speech already turned into a question by an explicit «answer» press. */
  manualUsed?: boolean
}

export class QuestionCoordinator {
  private activeQ: QuestionEvent | null = null
  private history: QuestionEvent[] = []
  private pending: (Candidate & { u: Utterance })[] = []
  private recent: Tracked[] = []

  constructor(
    private sessionId: string,
    private opts: CoordinatorOptions,
    private newId: () => string
  ) {}

  get active(): QuestionEvent | null {
    return this.activeQ
  }
  get candidates(): Candidate[] {
    return this.pending.map(({ u: _u, ...c }) => c)
  }
  get questions(): QuestionEvent[] {
    return this.history
  }

  isCurrent(questionId: string, revision: number): boolean {
    return !!this.activeQ && this.activeQ.questionId === questionId && this.activeQ.revision === revision
  }

  onUtterance(u: Utterance): Decision {
    const text = u.text.trim()
    if (!text) return { type: 'ignore', reason: 'empty' }
    this.recent = this.recent.filter((r) => u.endMs - r.endMs < 60_000)

    if (u.source === 'user') {
      // Speakers instead of headphones: the mic hears the remote voice too.
      const echo = this.recent.find((r) => r.source === 'remote' && Math.abs(r.startMs - u.startMs) < 2500 && similarity(r.text, text) >= 0.6)
      if (echo) return { type: 'ignore', reason: 'echo' }
      if (this.activeQ && isExpandRequest(text)) return { type: 'expand', question: this.activeQ }
      if (!this.opts.answerUserSource) {
        this.recent.push({ ...u, text, consumed: true })
        return { type: 'ignore', reason: 'own_speech' }
      }
    }

    const tracked: Tracked = { ...u, text, consumed: false }
    this.recent.push(tracked)
    const { kind, confidence } = classify(text)
    if (kind === 'small_talk') {
      tracked.consumed = true
      return { type: 'ignore', reason: 'small_talk' }
    }

    const a = this.activeQ
    if (a && a.source === u.source) {
      const sim = similarity(a.text, text)
      if (sim >= this.opts.dupThreshold && u.endMs - a.endMs < this.opts.dupWindowMs) {
        tracked.consumed = true
        return { type: 'duplicate', of: a.questionId }
      }
      const gap = u.startMs - a.endMs
      if (gap >= 0 && gap <= this.opts.continuationGapMs && kind !== 'unknown') {
        tracked.consumed = true
        return this.revise(a, `${a.text} ${text}`, u.endMs, mergeKind(a.kind, kind))
      }
      if (kind === 'follow_up' && confidence === 'high' && u.startMs - a.endMs <= this.opts.followUpWindowMs) {
        tracked.consumed = true
        return this.revise(a, `${a.text} → ${text}`, u.endMs, a.kind)
      }
    }

    const dupOf = this.history.find((q) => u.endMs - q.endMs < this.opts.dupWindowMs && similarity(q.text, text) >= this.opts.dupThreshold)
    if (dupOf) {
      tracked.consumed = true
      return { type: 'duplicate', of: dupOf.questionId }
    }

    const askable = kind === 'question' || kind === 'coding_task' || kind === 'screen_reference' || kind === 'follow_up'
    if (askable && confidence === 'high') {
      tracked.consumed = true
      return this.open(text, u, kind, 'auto')
    }
    if (askable) {
      const c = { questionId: this.newId(), text, kind, reason: 'нет явных признаков вопроса', u }
      this.pending = [...this.pending.slice(-2), c]
      return { type: 'candidate', candidate: { questionId: c.questionId, text, kind, reason: c.reason } }
    }
    return { type: 'ignore', reason: kind }
  }

  /** «Ответить сейчас» — always available, even when auto-detection found nothing. */
  manual(trigger: QuestionTrigger, typed?: string): Decision {
    if (typed?.trim()) {
      const t = typed.trim()
      // I anchor a typed question at the latest heard speech, so everything said so far stays in its context window.
      const now = Math.max(this.activeQ?.endMs ?? 0, this.recent.at(-1)?.endMs ?? 0)
      return this.open(t, { source: 'user', text: t, startMs: now, endMs: now }, classify(t).kind, 'typed')
    }
    const last = this.pending.at(-1)
    if (last) return this.confirmCandidate(last.questionId, trigger)
    const fresh = this.recent.filter((r) => r.source === 'remote' && !r.consumed)
    if (fresh.length) {
      const lastEnd = fresh[fresh.length - 1].endMs
      const span = fresh.filter((r) => lastEnd - r.startMs <= 15_000).slice(-2)
      for (const r of span) r.consumed = true
      const text = span.map((r) => r.text).join(' ')
      const kind = classify(text).kind
      return this.open(text, { source: 'remote', text, startMs: span[0].startMs, endMs: lastEnd }, kind === 'statement' ? 'question' : kind, trigger)
    }
    // An explicit «answer» with nothing new from the other side: the user likely said the question themselves (a test,
    // or the other person is not captured). I take their last phrase — but if a question is already open, only when the
    // phrase sounds like a question, so pressing «answer» right after answering out loud re-answers instead.
    const mine = this.recent.filter((r) => r.source === 'user' && !r.manualUsed && (!this.activeQ || r.startMs > this.activeQ.endMs))
    if (mine.length) {
      const lastEnd = mine[mine.length - 1].endMs
      const span = mine.filter((r) => lastEnd - r.startMs <= 15_000).slice(-2)
      const text = span.map((r) => r.text).join(' ')
      const kind = classify(text).kind
      const asks = kind !== 'statement' && kind !== 'small_talk'
      if (asks || !this.activeQ) {
        for (const r of span) r.manualUsed = true
        return this.open(text, { source: 'user', text, startMs: span[0].startMs, endMs: lastEnd }, asks ? kind : 'question', trigger)
      }
    }
    if (this.activeQ) return { type: 'reanswer', question: this.activeQ }
    return { type: 'ignore', reason: 'nothing_to_answer' }
  }

  confirmCandidate(id: string, trigger: QuestionTrigger = 'manual'): Decision {
    const c = this.pending.find((p) => p.questionId === id)
    if (!c) return { type: 'ignore', reason: 'no_candidate' }
    this.pending = this.pending.filter((p) => p !== c)
    const tracked = this.recent.find((r) => r.startMs === c.u.startMs && r.source === c.u.source)
    if (tracked) tracked.consumed = true
    return this.open(c.text, c.u, c.kind, trigger, c.questionId)
  }

  dismissCandidate(id: string): void {
    this.pending = this.pending.filter((p) => p.questionId !== id)
  }

  /** User corrected a misrecognized question. */
  edit(text: string): Decision {
    if (!this.activeQ || !text.trim()) return { type: 'ignore', reason: 'no_active' }
    return this.revise(this.activeQ, text.trim(), this.activeQ.endMs, classify(text).kind)
  }

  /** «Следующий вопрос»: I clear the board without inventing a new question. */
  clear(): void {
    if (this.activeQ) this.activeQ = { ...this.activeQ, status: 'dismissed' }
    this.activeQ = null
    this.pending = []
  }

  markAnswered(questionId: string, revision: number): void {
    if (this.isCurrent(questionId, revision)) this.activeQ = { ...this.activeQ!, status: 'answered' }
  }

  private open(text: string, u: Utterance, kind: UtteranceKind, trigger: QuestionTrigger, id?: string): Decision {
    const prev = this.activeQ
    const q: QuestionEvent = {
      sessionId: this.sessionId,
      questionId: id ?? this.newId(),
      revision: 1,
      source: u.source,
      text,
      startMs: u.startMs,
      endMs: u.endMs,
      kind,
      status: 'confirmed',
      supersedes: prev?.questionId ?? null,
      trigger
    }
    if (prev) this.history = this.history.map((h) => (h.questionId === prev.questionId ? { ...h, status: 'superseded' } : h))
    this.history.push(q)
    if (this.history.length > 200) this.history.shift()
    this.activeQ = q
    this.pending = this.pending.filter((p) => similarity(p.text, text) < this.opts.dupThreshold)
    return { type: 'new', question: q, superseded: prev }
  }

  private revise(a: QuestionEvent, text: string, endMs: number, kind: UtteranceKind): Decision {
    const q: QuestionEvent = { ...a, text, endMs, kind, revision: a.revision + 1, status: 'confirmed' }
    this.history = this.history.map((h) => (h.questionId === a.questionId ? q : h))
    this.activeQ = q
    return { type: 'revise', question: q }
  }
}

function mergeKind(a: UtteranceKind, b: UtteranceKind): UtteranceKind {
  if (a === 'coding_task' || b === 'coding_task') return 'coding_task'
  if (a === 'screen_reference' || b === 'screen_reference') return 'screen_reference'
  return a
}
