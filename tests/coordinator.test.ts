import { describe, expect, it } from 'vitest'
import { AnswerBoard } from '../src/main/session/board'
import { DEFAULT_COORDINATOR, QuestionCoordinator } from '../src/main/session/coordinator'
import { classify, similarity } from '../src/main/session/detector'
import type { AnswerEvent } from '../src/shared/types'

let n = 0
const id = () => `id${++n}`
const coord = (practice = false) => new QuestionCoordinator('s', { ...DEFAULT_COORDINATOR, answerUserSource: practice }, id)

describe('classify', () => {
  it.each([
    ['Explain idempotency in REST APIs', 'question'],
    ['Расскажите про ваш опыт с PostgreSQL', 'question'],
    ['Розкажіть про ваш досвід з Kubernetes', 'question'],
    ['Как работает сборщик мусора в Java', 'question'],
    ['Чи працювали ви з Kafka', 'question'],
    ['Есть ли у вас опыт с микросервисами', 'question'],
    ['Напишите функцию разворота связного списка', 'coding_task'],
    ['Посмотрите на код на экране', 'screen_reference'],
    ['А почему именно так?', 'follow_up'],
    ['Как дела?', 'small_talk'],
    ['Can you hear me?', 'small_talk'],
    ['Мы сейчас используем микросервисную архитектуру в компании', 'statement']
  ])('%s → %s', (text, kind) => {
    expect(classify(text).kind).toBe(kind)
  })

  it('question without question word or mark is only a low-confidence candidate', () => {
    expect(classify('ваш опыт с докером?').confidence).toBe('high')
    expect(classify('ну а докер').kind).not.toBe('question')
  })
})

describe('similarity', () => {
  it('near-identical ASR variants are similar, different questions are not', () => {
    expect(similarity('Explain idempotency in REST APIs', 'explain idempotency in rest api')).toBeGreaterThan(0.85)
    expect(similarity('What is a mutex', 'How does garbage collection work')).toBeLessThan(0.4)
  })
})

describe('QuestionCoordinator', () => {
  it('new question supersedes the previous one', () => {
    const c = coord()
    const a = c.onUtterance({ source: 'remote', text: 'What is a mutex?', startMs: 0, endMs: 1500 })
    const b = c.onUtterance({ source: 'remote', text: 'How does garbage collection work in Java?', startMs: 20000, endMs: 22000 })
    expect(a.type).toBe('new')
    expect(b.type).toBe('new')
    if (b.type === 'new' && a.type === 'new') expect(b.question.supersedes).toBe(a.question.questionId)
  })

  it('continuation within the gap becomes a new revision, not a new question', () => {
    const c = coord()
    c.onUtterance({ source: 'remote', text: 'Tell me about databases.', startMs: 0, endMs: 1500 })
    const d = c.onUtterance({ source: 'remote', text: 'Specifically how indexes work.', startMs: 2500, endMs: 4000 })
    expect(d.type).toBe('revise')
    if (d.type === 'revise') expect(d.question.revision).toBe(2)
  })

  it('duplicate within the window is suppressed', () => {
    const c = coord()
    c.onUtterance({ source: 'remote', text: 'Explain idempotency in REST APIs', startMs: 0, endMs: 1500 })
    const d = c.onUtterance({ source: 'remote', text: 'explain idempotency in rest APIs', startMs: 9000, endMs: 10500 })
    expect(d.type).toBe('duplicate')
  })

  it('follow-up updates the current question with preserved context', () => {
    const c = coord()
    c.onUtterance({ source: 'remote', text: 'Как работает индекс в PostgreSQL?', startMs: 0, endMs: 1500 })
    const d = c.onUtterance({ source: 'remote', text: 'А почему B-tree, а не hash?', startMs: 15000, endMs: 16500 })
    expect(d.type).toBe('revise')
    if (d.type === 'revise') expect(d.question.text).toContain('PostgreSQL')
  })

  it('own speech is ignored in live mode but answered in practice mode', () => {
    expect(coord(false).onUtterance({ source: 'user', text: 'What is a mutex?', startMs: 0, endMs: 1000 }).type).toBe('ignore')
    expect(coord(true).onUtterance({ source: 'user', text: 'What is a mutex?', startMs: 0, endMs: 1000 }).type).toBe('new')
  })

  it('mic echo of the remote voice is ignored', () => {
    const c = coord(true)
    c.onUtterance({ source: 'remote', text: 'What is a mutex and when to use it?', startMs: 0, endMs: 2000 })
    expect(c.onUtterance({ source: 'user', text: 'what is a mutex and when to use it', startMs: 200, endMs: 2100 }).type).toBe('ignore')
  })

  it('ambiguous utterance becomes a candidate and answer-now confirms it', () => {
    const c = coord()
    const d = c.onUtterance({ source: 'remote', text: 'опыт с докером', startMs: 0, endMs: 1000 })
    expect(['candidate', 'ignore']).toContain(d.type)
    const m = c.manual('hotkey')
    expect(m.type).toBe('new')
  })

  it('answer-now with nothing heard reports it instead of inventing a question', () => {
    expect(coord().manual('hotkey').type).toBe('ignore')
  })
})

describe('AnswerBoard × coordinator: 1000 synthetic turn transitions', () => {
  it('never lets an answer for a stale (question, revision) become visible', () => {
    let seed = 42
    const rnd = () => (seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31
    const c = coord()
    const board = new AnswerBoard()
    const topics = ['mutex', 'garbage collection', 'REST idempotency', 'CAP theorem', 'Kubernetes pods', 'database indexes', 'event loop', 'TCP handshake']
    const inflight: AnswerEvent[] = []
    let t = 0
    let violations = 0
    let newQs = 0
    let revisions = 0
    let dups = 0
    for (let step = 0; step < 1000; step++) {
      t += 500 + Math.floor(rnd() * 6000)
      const r = rnd()
      let dec
      if (r < 0.35) {
        dec = c.onUtterance({
          source: 'remote',
          text: `Can you explain ${topics[Math.floor(rnd() * topics.length)]} in detail number ${step}?`,
          startMs: t,
          endMs: t + 1500
        })
      } else if (r < 0.5 && c.active) {
        dec = c.onUtterance({ source: 'remote', text: c.active.text, startMs: t, endMs: t + 1500 })
      } else if (r < 0.65 && c.active) {
        dec = c.onUtterance({ source: 'remote', text: 'And why is that important?', startMs: c.active.endMs + 1000, endMs: c.active.endMs + 2500 })
      } else {
        // deliver a late chunk from a random earlier request
        const ev = inflight[Math.floor(rnd() * inflight.length)]
        if (ev) {
          const shown = board.apply({ ...ev, text: ev.text + '…' })
          const a = c.active
          if (shown && (!a || a.questionId !== ev.questionId || a.revision !== ev.revision)) violations++
        }
        continue
      }
      if (dec.type === 'new' || dec.type === 'revise') {
        dec.type === 'new' ? newQs++ : revisions++
        board.setActive(dec.question.questionId, dec.question.revision)
        const ev: AnswerEvent = {
          sessionId: 's',
          questionId: dec.question.questionId,
          revision: dec.question.revision,
          answerId: id(),
          kind: 'say',
          provider: 'p',
          model: 'm',
          promptPreset: 'x',
          text: '',
          status: 'streaming',
          firstTokenMs: null,
          latencyMs: null,
          usage: null,
          usageCostUsd: null,
          error: null
        }
        board.claim('say', ev.answerId)
        inflight.push(ev)
      }
      if (dec.type === 'duplicate') dups++
      for (const shown of Object.values(board.answers)) {
        if (shown && !c.isCurrent(shown.questionId, shown.revision)) violations++
      }
    }
    expect(violations).toBe(0)
    expect(newQs).toBeGreaterThan(50)
    expect(revisions).toBeGreaterThan(20)
    expect(dups).toBeGreaterThan(20)
  })
})
