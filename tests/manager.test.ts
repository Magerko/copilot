import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import type { ChatRequest, Profile, ProviderConfig, Settings, StreamChunk } from '@shared/types'
import { BudgetManager } from '../src/main/budget/budget'
import type { ProviderAdapter } from '../src/main/providers/adapter'
import { SessionManager, type ResolvedTarget } from '../src/main/session/manager'
import { Db } from '../src/main/storage/db'
import { DEFAULT_SETTINGS, deepMerge } from '../src/main/storage/settings'

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

class FakeAdapter implements ProviderAdapter {
  calls: ChatRequest[] = []
  constructor(
    private reply: (req: ChatRequest) => string,
    private delayMs = 2
  ) {}
  async listModels() {
    return []
  }
  async *stream(req: ChatRequest, signal: AbortSignal): AsyncIterable<StreamChunk> {
    this.calls.push(req)
    for (const word of this.reply(req).split(/(?<= )/)) {
      await sleep(this.delayMs)
      if (signal.aborted) throw Object.assign(new Error('aborted'), { name: 'AbortError' })
      yield { type: 'text', text: word }
    }
    yield { type: 'usage', inputTokens: 10, outputTokens: 5 }
  }
}

function setup(opts: { local?: boolean; cloudConsent?: boolean; delayMs?: number; failLocal?: boolean; offline?: boolean; history?: boolean } = {}) {
  const settings: Settings = deepMerge(DEFAULT_SETTINGS, {
    autoAnswer: true,
    history: opts.history ?? false,
    offline: opts.offline ?? false,
    consent: { cloud: opts.cloudConsent ?? false, history: opts.history ?? false }
  })
  const cfg: ProviderConfig = {
    id: 'p',
    label: 'Fake',
    preset: 'custom',
    protocol: 'openai',
    baseUrl: 'http://127.0.0.1:1',
    hasKey: false,
    allowFallback: false,
    timeoutMs: 5000
  }
  const adapter = new FakeAdapter((req) => {
    const user = String(req.messages[req.messages.length - 1].content)
    const q = /<question>\n([^\n]+)\n<\/question>/.exec(user)?.[1] ?? '?'
    return req.maxTokens > 300 ? `• point for ${q}` : `answer for ${q}`
  }, opts.delayMs)
  const target: ResolvedTarget = { cfg, model: 'm', adapter, isLocal: opts.local ?? true }
  const cloud = new FakeAdapter(() => 'cloud answer')
  const cloudTarget: ResolvedTarget = { cfg: { ...cfg, id: 'cloud', label: 'Cloud', allowFallback: true }, model: 'c', adapter: cloud, isLocal: false }
  if (opts.failLocal)
    adapter.stream = async function* () {
      yield* []
      throw new TypeError('fetch failed')
    }
  const profile: Profile = { id: 'default', name: 'Test', preset: 'backend', style: 'natural', notes: '' }
  let n = 0
  const db = new Db(join(mkdtempSync(join(tmpdir(), 'km-mgr-')), 'k.db'))
  const mgr = new SessionManager({
    settings: () => settings,
    db,
    profile: () => profile,
    resolve: () => target,
    fallback: () => cloudTarget,
    // Default limits on purpose: maxConcurrent=2 is what exposed the abort/slot race.
    budget: new BudgetManager(settings.budget, {}, { now: Date.now, spentTodayBefore: () => 0 }),
    newId: () => `id${++n}`,
    now: Date.now,
    emit: () => {},
    log: () => {}
  })
  return { mgr, adapter, cloud, db }
}

async function until(cond: () => boolean, ms = 2000) {
  const t0 = Date.now()
  while (!cond()) {
    if (Date.now() - t0 > ms) throw new Error('timeout')
    await sleep(5)
  }
}

describe('SessionManager', () => {
  it('typed question yields say + points and settles in answer_ready', async () => {
    const { mgr } = setup()
    mgr.start({ mode: 'practice' })
    mgr.askTyped('Что такое индекс в базе данных?')
    await until(() => mgr.snap.answers.say?.status === 'done' && mgr.snap.answers.points?.status === 'done')
    expect(mgr.snap.answers.say?.text).toBe('answer for Что такое индекс в базе данных?')
    expect(mgr.snap.answers.points?.text).toContain('point for')
    expect(mgr.snap.state).toBe('answer_ready')
  })

  it('cloud model without cloud consent is blocked before any request', async () => {
    const { mgr, adapter } = setup({ local: false, cloudConsent: false })
    mgr.start({ mode: 'practice' })
    mgr.askTyped('Почему вы ушли с прошлой работы?')
    await until(() => mgr.snap.answers.say?.status === 'blocked')
    expect(adapter.calls).toHaveLength(0)
  })

  it('a newer question replaces the streaming answer; old text never shows up', async () => {
    const { mgr } = setup({ delayMs: 15 })
    mgr.start({ mode: 'practice' })
    mgr.askTyped('Первый вопрос про очереди сообщений?')
    await until(() => !!mgr.snap.answers.say?.text)
    mgr.askTyped('Второй вопрос про индексы в PostgreSQL?')
    await until(() => mgr.snap.answers.say?.status === 'done' && mgr.snap.answers.points?.status === 'done')
    expect(mgr.snap.answers.say?.text).toContain('Второй')
    expect(mgr.snap.answers.say?.text).not.toContain('Первый')
    expect(mgr.snap.activeQuestion?.text).toContain('Второй')
    expect(mgr.snap.state).toBe('answer_ready')
  })

  it('fallback never goes to the cloud without cloud consent', async () => {
    const { mgr, cloud } = setup({ failLocal: true, cloudConsent: false })
    mgr.start({ mode: 'practice' })
    mgr.askTyped('Расскажите о себе?')
    await until(() => mgr.snap.answers.say?.status === 'error')
    expect(cloud.calls).toHaveLength(0)
    expect(mgr.snap.state).toBe('error')
  })

  it('fallback to the cloud is used when consent is given', async () => {
    const { mgr, cloud } = setup({ failLocal: true, cloudConsent: true })
    mgr.start({ mode: 'practice' })
    mgr.askTyped('Расскажите о себе?')
    await until(() => mgr.snap.answers.say?.status === 'done')
    expect(cloud.calls.length).toBeGreaterThan(0)
    expect(mgr.snap.answers.say?.text).toBe('cloud answer')
  })

  it('offline mode blocks a cloud model even when it is reached through loopback', async () => {
    const { mgr, adapter } = setup({ local: false, cloudConsent: true, offline: true })
    mgr.start({ mode: 'practice' })
    mgr.askTyped('Что такое CAP-теорема?')
    await until(() => mgr.snap.answers.say?.status === 'blocked')
    expect(mgr.snap.answers.say?.error?.code).toBe('offline_blocked')
    expect(adapter.calls).toHaveLength(0)
  })

  it('a blocked answer does not leave the UI in generating', async () => {
    const { mgr } = setup({ local: false, cloudConsent: false })
    mgr.start({ mode: 'practice' })
    mgr.askTyped('Почему вы ушли с прошлой работы?')
    await until(() => mgr.snap.answers.say?.status === 'blocked')
    expect(mgr.snap.state).not.toBe('generating')
  })

  it('in a call my own partial speech never shows as the overlay question; the interlocutor s does', () => {
    const { mgr } = setup()
    const id = mgr.start({ mode: 'live' })
    const partial = (source: 'user' | 'remote', text: string) =>
      mgr.onSegment({ sessionId: id, segmentId: `s-${source}`, source, startMs: 0, endMs: 1000, text, isFinal: false, lang: null })
    partial('user', 'это я проговариваю вопрос вслух')
    expect(mgr.snap.partial.user).toBeUndefined()
    partial('remote', 'расскажите про CAP теорему')
    expect(mgr.snap.partial.remote).toBe('расскажите про CAP теорему')
  })

  it('in practice mode my own partial is shown (I read questions aloud)', () => {
    const { mgr } = setup()
    const id = mgr.start({ mode: 'practice' })
    mgr.onSegment({ sessionId: id, segmentId: 'u', source: 'user', startMs: 0, endMs: 1000, text: 'что такое транзакция', isFinal: false, lang: null })
    expect(mgr.snap.partial.user).toBe('что такое транзакция')
  })

  it('continues a previous session: its transcript is restored into the new session', () => {
    const { mgr, db } = setup({ history: true })
    const id = mgr.start({ mode: 'live' })
    mgr.onSegment({
      sessionId: id,
      segmentId: 's1',
      source: 'remote',
      startMs: 1000,
      endMs: 3000,
      text: 'что такое транзакция в базе данных',
      isFinal: true,
      lang: 'ru'
    })
    mgr.stop()

    const r = db.lastResumable()
    expect(r).not.toBeNull()
    expect(r!.id).toBe(id)
    expect(r!.segments).toBe(1)

    const newId = mgr.continuePrevious(db.sessionSegments(r!.id), r!.mode)
    expect(newId).not.toBe(id)
    expect(mgr.snap.sessionId).toBe(newId)
    expect(mgr.snap.segments.some((s) => s.text.includes('транзакция'))).toBe(true)
    // the restored transcript is rebased to just-before-now so it lands in a new question's context window
    expect(mgr.snap.segments[mgr.snap.segments.length - 1].endMs).toBeLessThanOrEqual(0)
  })

  it('rapid re-asking with default concurrency never blocks the newest question', async () => {
    const { mgr } = setup({ delayMs: 10 })
    mgr.start({ mode: 'practice' })
    for (const q of ['Вопрос один про кэш?', 'Вопрос два про очереди?', 'Вопрос три про индексы?', 'Вопрос четыре про шардирование?']) {
      mgr.askTyped(q)
      await until(() => !!mgr.snap.answers.say?.text)
    }
    await until(() => mgr.snap.answers.say?.status === 'done' && mgr.snap.answers.points?.status === 'done')
    expect(mgr.snap.answers.say?.text).toContain('четыре')
    expect(mgr.snap.state).toBe('answer_ready')
  })
})
