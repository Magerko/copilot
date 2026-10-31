import type {
  AnswerEvent,
  AnswerKind,
  AppSnapshot,
  ChatImage,
  ComponentStatus,
  ModelRole,
  Profile,
  ProviderConfig,
  QuestionEvent,
  ScreenTask,
  SessionStartOptions,
  Settings,
  Source,
  TranscriptSegment
} from '@shared/types'
import type { BudgetManager } from '../budget/budget'
import { buildPrompt, SCREEN_CONTEXT_MS } from '../context/prompt'
import { Bm25Index, selectKnowledge, type Chunk } from '../context/retrieval'
import type { ProviderAdapter } from '../providers/adapter'
import { appError, ProviderError, toAppError } from '../providers/errors'
import { runStream } from '../providers/runner'
import type { Db } from '../storage/db'
import { AnswerBoard } from './board'
import { DEFAULT_COORDINATOR, QuestionCoordinator, type Decision } from './coordinator'
import { t } from '@shared/i18n'

export interface ResolvedTarget {
  cfg: ProviderConfig
  model: string
  adapter: ProviderAdapter
  isLocal: boolean
}

export interface SessionDeps {
  settings(): Settings
  db: Db
  profile(): Profile
  resolve(role: ModelRole): ResolvedTarget | null
  fallback(role: ModelRole, excludeProviderId: string): ResolvedTarget | null
  budget: BudgetManager
  newId(): string
  now(): number
  emit(): void
  log(kind: string, data: unknown): void
  outcome?(providerId: string, model: string, ok: boolean): void
}

interface Inflight {
  ctrl: AbortController
  questionId: string
  revision: number
  kind: AnswerKind
  /** I free the budget slot now: abort() settles asynchronously, and a replacement request starts in the same tick. */
  release: () => void
}

const cloudDenied = () => t('Отправка в облако не разрешена — включите её в «Приватность» или выберите локальную модель')

const off = (): ComponentStatus => ({ state: 'off', label: t('выкл.') })

export function emptySnapshot(): AppSnapshot {
  return {
    sessionId: null,
    startedAt: null,
    state: 'idle',
    listening: false,
    activeQuestion: null,
    candidates: [],
    answers: {},
    recentQuestions: [],
    partial: {},
    segments: [],
    status: {
      mic: off(),
      system: off(),
      asr: off(),
      llm: off(),
      vision: off(),
      overlay: off(),
      protection: off(),
      network: { state: 'ok', label: t('онлайн') }
    },
    cost: { usd: 0, unknownPriced: 0, requests: 0 },
    budgetBlocked: null,
    levels: { user: 0, remote: 0 },
    notice: null
  }
}

export class SessionManager {
  readonly snap: AppSnapshot = emptySnapshot()
  private coord: QuestionCoordinator | null = null
  private board = new AnswerBoard()
  private inflight = new Map<string, Inflight>()
  private finals: TranscriptSegment[] = []
  private index: Bm25Index | null = null
  private chunks: Chunk[] = []
  private startedAt = 0
  private persist = true
  private answerUserSource = false

  constructor(private d: SessionDeps) {}

  get active(): boolean {
    return this.snap.sessionId !== null
  }

  sessionClockMs(): number {
    return this.startedAt ? this.d.now() - this.startedAt : 0
  }

  start(opts: SessionStartOptions): string {
    if (this.snap.sessionId) this.stop()
    const id = this.d.newId()
    const s = this.d.settings()
    this.persist = s.history && s.consent.history
    this.startedAt = this.d.now()
    this.answerUserSource = opts.mode === 'practice'
    this.coord = new QuestionCoordinator(id, { ...DEFAULT_COORDINATOR, answerUserSource: this.answerUserSource }, this.d.newId)
    this.board.setActive(null)
    this.finals = []
    this.reloadKnowledge()
    this.d.budget.resetSession()
    if (this.persist) {
      const title = `${new Date(this.startedAt).toLocaleString('ru-RU')} · ${this.d.profile().name}`
      this.d.db.startSession(id, this.d.profile().id, opts.mode, title)
    }
    Object.assign(this.snap, {
      sessionId: id,
      startedAt: this.startedAt,
      state: 'listening',
      listening: true,
      activeQuestion: null,
      candidates: [],
      answers: {},
      recentQuestions: [],
      partial: {},
      segments: [],
      budgetBlocked: null,
      notice: null
    })
    this.syncCost()
    this.d.emit()
    return id
  }

  /** Continue a prior session: start fresh, then preload its transcript so the conversation keeps its context. */
  continuePrevious(prior: TranscriptSegment[], mode: 'practice' | 'live' | 'meeting'): string {
    const id = this.start({ mode })
    const recent = prior.slice(-300)
    if (recent.length) {
      // The old timestamps are on the old session's clock; I rebase them to just-before-now so they fall in the context window.
      const shift = -1000 - recent[recent.length - 1].endMs
      this.finals = recent.map((f) => ({ ...f, sessionId: id, startMs: f.startMs + shift, endMs: f.endMs + shift }))
      this.snap.segments = this.finals.slice(-40)
    }
    this.snap.notice = t('Продолжена прошлая сессия — контекст восстановлен.')
    this.d.emit()
    return id
  }

  stop(): void {
    if (!this.snap.sessionId) return
    this.cancelAll()
    if (this.persist) this.d.db.endSession(this.snap.sessionId)
    Object.assign(this.snap, { sessionId: null, startedAt: null, state: 'stopped', listening: false, partial: {}, candidates: [] })
    // Capture statuses come from the renderer only while it captures; after stop nothing else would reset them, so I do it here.
    this.snap.status.mic = off()
    this.snap.status.system = off()
    this.snap.levels = { user: 0, remote: 0 }
    this.coord = null
    this.startedAt = 0
    this.d.emit()
  }

  pause(): void {
    if (!this.active) return
    this.snap.listening = false
    this.snap.state = 'paused'
    this.snap.partial = {}
    this.d.emit()
  }

  resume(): void {
    if (!this.active) return
    this.snap.listening = true
    this.snap.state = this.snap.activeQuestion ? 'answer_ready' : 'listening'
    this.d.emit()
  }

  /** Emergency stop: I end every stream and request now. */
  panic(): void {
    this.cancelAll()
    this.stop()
  }

  reloadKnowledge(): void {
    const chunks = this.d.db.chunksForProfile(this.d.profile().id)
    this.chunks = chunks
    this.index = chunks.length ? new Bm25Index(chunks) : null
  }

  setStatus(key: keyof AppSnapshot['status'], st: ComponentStatus): void {
    this.snap.status[key] = st
    this.d.emit()
  }

  setLevel(source: Source, rms: number): void {
    this.snap.levels[source] = rms
  }

  notice(text: string | null): void {
    this.snap.notice = text
    this.d.emit()
  }

  onSegment(seg: TranscriptSegment): void {
    if (!this.coord || !this.snap.listening || seg.sessionId !== this.snap.sessionId) return
    if (!seg.isFinal) {
      // In a call my own speech is not answered, so I don't surface its partial as the overlay's live question.
      if (seg.source === 'user' && !this.answerUserSource) return
      this.snap.partial = { ...this.snap.partial, [seg.source]: seg.text }
      if (this.snap.state === 'listening' || this.snap.state === 'answer_ready') this.snap.state = 'partial_transcript'
      this.d.emit()
      return
    }
    this.snap.partial = { ...this.snap.partial, [seg.source]: undefined }
    if (!seg.text.trim()) {
      this.d.emit()
      return
    }
    this.finals.push(seg)
    const cutoff = seg.endMs - 30 * 60_000
    while (this.finals.length && this.finals[0].endMs < cutoff) this.finals.shift()
    this.snap.segments = this.finals.slice(-40)
    if (this.persist) this.d.db.addSegment(seg)
    this.handle(this.coord.onUtterance({ source: seg.source, text: seg.text, startMs: seg.startMs, endMs: seg.endMs }), 'auto')
  }

  /**
   * Cue mode replaces the sentence + talking points pair with one line of cues, and brings the detailed answer along
   * right away, so the substance is in view while the user speaks from the cues.
   */
  private quickKinds(): AnswerKind[] {
    return this.d.settings().answerFormat === 'cues' ? ['say', 'deep'] : ['say', 'points']
  }

  answerNow(kind: AnswerKind = 'say', trigger: 'manual' | 'hotkey' = 'manual'): void {
    if (!this.coord) return
    if (kind === 'deep' && this.coord.active) {
      this.generate(this.coord.active, ['deep'])
      return
    }
    this.handle(this.coord.manual(trigger), 'manual')
  }

  askTyped(text: string): void {
    if (!this.coord) this.start({ mode: 'practice' })
    this.handle(this.coord!.manual('typed', text), 'manual')
  }

  confirmCandidate(id: string): void {
    if (this.coord) this.handle(this.coord.confirmCandidate(id), 'manual')
  }

  dismissCandidate(id: string): void {
    this.coord?.dismissCandidate(id)
    this.syncQuestions()
    this.d.emit()
  }

  editQuestion(text: string): void {
    if (this.coord) this.handle(this.coord.edit(text), 'manual')
  }

  nextQuestion(): void {
    if (!this.coord) return
    this.cancelAll()
    this.coord.clear()
    this.board.setActive(null)
    this.snap.state = 'listening'
    this.syncQuestions()
    this.d.emit()
  }

  approveBudget(): void {
    this.d.budget.approveOverride()
    this.snap.budgetBlocked = null
    this.d.emit()
  }

  async screen(image: ChatImage | null, ocrText: string | null, task: ScreenTask, withCode: boolean, codeLang: string, instruction = ''): Promise<void> {
    if (!this.coord) this.start({ mode: 'practice' })
    const labels: Record<ScreenTask, string> = {
      context: 'Вопрос из разговора',
      custom: 'Своё задание',
      solve: 'Решить задачу',
      explain: 'Объясни условие',
      approach: 'Предложи подход',
      review: 'Разбери код'
    }
    const text = task === 'custom' && instruction.trim() ? instruction.trim().slice(0, 300) : t(labels[task])
    const decision = this.coord!.manual('manual', t('[Экран] {text}', { text }))
    if (decision.type !== 'new') return
    this.applyQuestion(decision.question)
    this.syncQuestions()
    this.generate(decision.question, ['screen'], { image, ocrText, task, withCode, codeLang, instruction: instruction.trim() })
  }

  private handle(dec: Decision, via: 'auto' | 'manual'): void {
    const s = this.d.settings()
    switch (dec.type) {
      case 'new':
      case 'revise': {
        this.applyQuestion(dec.question)
        const auto = via === 'manual' || s.autoAnswer
        if (auto) this.generate(dec.question, this.quickKinds())
        else this.snap.state = 'question_confirmed'
        break
      }
      case 'reanswer':
        this.generate(dec.question, this.quickKinds())
        break
      case 'expand':
        this.generate(dec.question, ['deep'])
        break
      case 'candidate':
        this.snap.state = 'question_candidate'
        break
      case 'duplicate':
        this.d.log('duplicate_suppressed', { of: dec.of })
        break
      case 'ignore':
        if (via === 'manual') this.snap.notice = dec.reason === 'nothing_to_answer' ? t('Пока нечего отвечать — вопрос не распознан') : null
        if (this.snap.state === 'partial_transcript') this.snap.state = this.snap.activeQuestion ? 'answer_ready' : 'listening'
        break
    }
    this.syncQuestions()
    this.d.emit()
  }

  private applyQuestion(q: QuestionEvent): void {
    for (const [id, f] of this.inflight) {
      if (f.questionId !== q.questionId || f.revision !== q.revision) {
        f.ctrl.abort()
        f.release()
        this.inflight.delete(id)
      }
    }
    this.board.setActive(q.questionId, q.revision)
    if (q.supersedes) this.snap.state = 'superseded'
    if (this.persist) this.d.db.upsertQuestion(q)
  }

  private syncQuestions(): void {
    const c = this.coord
    const a = c?.active ?? null
    this.snap.activeQuestion = a ? { questionId: a.questionId, revision: a.revision, text: a.text, source: a.source, kind: a.kind, trigger: a.trigger } : null
    this.snap.candidates = c?.candidates ?? []
    this.snap.recentQuestions = (c?.questions ?? [])
      .filter((q) => q.questionId !== a?.questionId)
      .slice(-6)
      .reverse()
      .map((q) => ({ questionId: q.questionId, text: q.text }))
    this.snap.answers = this.board.answers
  }

  private syncCost(): void {
    this.snap.cost = this.d.budget.snapshot()
  }

  private cancelAll(): void {
    for (const f of this.inflight.values()) {
      f.ctrl.abort()
      f.release()
    }
    this.inflight.clear()
  }

  /** Say-it first; I start points once say has its first token, so the long answer never delays the short one. */
  private generate(
    q: QuestionEvent,
    kinds: AnswerKind[],
    screen?: { image: ChatImage | null; ocrText: string | null; task: ScreenTask; withCode: boolean; codeLang: string; instruction?: string }
  ): void {
    const [first, ...rest] = kinds
    this.snap.state = 'generating'
    void this.request(q, first, screen, () => {
      for (const k of rest) void this.request(q, k)
    })
  }

  private async request(
    q: QuestionEvent,
    kind: AnswerKind,
    screen?: { image: ChatImage | null; ocrText: string | null; task: ScreenTask; withCode: boolean; codeLang: string; instruction?: string },
    onFirstToken?: () => void
  ): Promise<void> {
    const role: ModelRole = kind === 'deep' ? 'deep_answer' : kind === 'screen' && screen?.image ? 'vision' : 'quick_answer'
    const initial = this.d.resolve(role) ?? (role === 'deep_answer' ? this.d.resolve('quick_answer') : null)
    const answerId = this.d.newId()
    const base: AnswerEvent = {
      sessionId: q.sessionId,
      questionId: q.questionId,
      revision: q.revision,
      answerId,
      kind,
      provider: initial?.cfg.id ?? '',
      model: initial?.model ?? '',
      promptPreset: '',
      text: '',
      status: 'streaming',
      firstTokenMs: null,
      latencyMs: null,
      usage: null,
      usageCostUsd: null,
      error: null
    }
    this.board.claim(kind, answerId)
    const publish = (ev: AnswerEvent) => {
      if (this.board.apply(ev)) {
        this.snap.answers = this.board.answers
        this.d.emit()
      }
    }

    if (!initial) {
      this.finish(
        {
          ...base,
          status: 'error',
          error: appError(
            'unsupported',
            role === 'vision' ? t('Модель для изображений не выбрана') : t('Не выбрана модель для ответов — откройте «Провайдеры»')
          )
        },
        publish
      )
      onFirstToken?.()
      return
    }

    const profile = this.d.profile()
    const s = this.d.settings()
    if (!initial.isLocal && s.offline) {
      this.finish({ ...base, status: 'blocked', error: appError('offline_blocked', t('Офлайн-режим: эта модель работает в облаке')) }, publish)
      onFirstToken?.()
      return
    }
    if (!initial.isLocal && !s.consent.cloud) {
      this.finish({ ...base, status: 'blocked', error: appError('unsupported', cloudDenied()) }, publish)
      onFirstToken?.()
      return
    }
    // «Solve it yourself» sends only the capture; «question from the conversation» looks at the last couple of minutes.
    const isolated = kind === 'screen' && screen?.task === 'solve'
    const windowMs = kind === 'screen' && screen?.task === 'context' ? SCREEN_CONTEXT_MS : s.contextWindowMin * 60_000
    const windowStart = q.endMs - windowMs
    const knowledge: Chunk[] = isolated ? [] : selectKnowledge(this.index, this.chunks, q.text)
    const prompt = buildPrompt({
      question: q.text,
      kind,
      profile,
      instructions: s.answerInstructions,
      cues: s.answerFormat === 'cues',
      answerLang: s.answerLang,
      transcript: isolated ? [] : this.finals.filter((f) => f.endMs >= windowStart && f.endMs <= q.endMs + 1000),
      earlierQuestions: (isolated ? [] : (this.coord?.questions ?? []))
        .filter((h) => h.questionId !== q.questionId)
        .slice(-8)
        .map((h) => h.text),
      knowledge,
      screen: screen
        ? {
            task: screen.task,
            withCode: screen.withCode,
            codeLang: screen.codeLang,
            ocrText: screen.ocrText ?? undefined,
            image: screen.image ?? undefined,
            instruction: screen.instruction || undefined
          }
        : undefined
    })
    base.promptPreset = prompt.preset

    let target: ResolvedTarget = initial
    let fellBack = false
    while (true) {
      const gate = this.d.budget.canStart(target.isLocal)
      if (!gate.ok) {
        const money = gate.reason !== 'rate' && gate.reason !== 'concurrency'
        if (money) this.snap.budgetBlocked = gate.reason
        this.finish(
          {
            ...base,
            provider: target.cfg.id,
            model: target.model,
            status: 'blocked',
            error: appError(money ? 'budget_blocked' : 'rate_limit', money ? gate.reason : t('Лимит запросов приложения — подождите или увеличьте лимит'))
          },
          publish
        )
        onFirstToken?.()
        return
      }
      const ctrl = new AbortController()
      const slot = target
      let held = true
      const release = (usage: { inputTokens: number; outputTokens: number } | null): number | null => {
        if (!held) return null
        held = false
        return this.d.budget.end(slot.cfg.id, slot.model, slot.isLocal, usage)
      }
      this.d.budget.begin()
      this.inflight.set(answerId, { ctrl, questionId: q.questionId, revision: q.revision, kind, release: () => void release(null) })
      let text = ''
      let ev: AnswerEvent = { ...base, provider: target.cfg.id, model: target.model }
      publish(ev)
      try {
        const res = await runStream(
          target.adapter,
          { model: target.model, messages: prompt.messages, maxTokens: prompt.maxTokens, temperature: prompt.temperature },
          ctrl.signal,
          {
            onFirstToken: (ms) => {
              ev = { ...ev, firstTokenMs: ms }
              onFirstToken?.()
              onFirstToken = undefined
            },
            onText: (delta) => {
              text += delta
              ev = { ...ev, text }
              publish(ev)
            }
          },
          { timeoutMs: target.cfg.timeoutMs }
        )
        const cost = release(res.usage)
        ev = { ...ev, text: res.text, status: 'done', latencyMs: res.latencyMs, firstTokenMs: res.firstTokenMs, usage: res.usage, usageCostUsd: cost }
        this.d.db.addUsage(this.d.newId(), this.persist ? q.sessionId : null, target.cfg.id, target.model, res.usage.inputTokens, res.usage.outputTokens, cost)
        this.d.outcome?.(target.cfg.id, target.model, true)
        this.finish(ev, publish)
        if (kind === 'say' || kind === 'screen') this.coord?.markAnswered(q.questionId, q.revision)
        return
      } catch (e) {
        release(null)
        const err = e instanceof ProviderError ? e.appError : toAppError(e)
        if (err.code === 'cancelled') {
          this.finish({ ...ev, text, status: this.board.isActive(q.questionId, q.revision) ? 'cancelled' : 'stale', error: err }, publish)
          return
        }
        const candidate = !fellBack && !text && ['timeout', 'server', 'rate_limit', 'network'].includes(err.code) ? this.d.fallback(role, target.cfg.id) : null
        // I apply the cloud consent gate to the fallback too: a local failure must not leak CV and transcript to the cloud.
        const now = this.d.settings()
        const fb = candidate && (candidate.isLocal || (now.consent.cloud && !now.offline)) ? candidate : null
        this.d.outcome?.(target.cfg.id, target.model, false)
        this.d.log('answer_error', { provider: target.cfg.id, model: target.model, code: err.code, status: err.status, detail: err.detail })
        if (fb) {
          this.snap.notice = t('{from}: {error}. Переключено на {to} — вы разрешили его как запасной.', {
            from: target.cfg.label,
            error: err.message,
            to: fb.cfg.label
          })
          target = fb
          fellBack = true
          continue
        }
        this.finish({ ...ev, text, status: 'error', error: err }, publish)
        onFirstToken?.()
        return
      } finally {
        this.inflight.delete(answerId)
        this.syncCost()
      }
    }
  }

  private finish(ev: AnswerEvent, publish: (ev: AnswerEvent) => void): void {
    publish(ev)
    if (this.persist && ev.status !== 'stale') this.d.db.upsertAnswer(ev)
    this.inflight.delete(ev.answerId)
    if (this.board.isActive(ev.questionId, ev.revision) && ![...this.inflight.values()].some((f) => f.questionId === ev.questionId)) {
      this.snap.state = ev.status === 'error' || ev.status === 'blocked' ? 'error' : 'answer_ready'
    }
    this.d.emit()
  }
}
