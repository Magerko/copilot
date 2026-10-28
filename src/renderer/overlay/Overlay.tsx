import { useEffect, useMemo, useRef, useState } from 'react'
import type { AnswerEvent, AppSnapshot, ConvState, Settings } from '@shared/types'
import { api, km } from '../lib/api'
import { useSettingsFeed, useSnapshot } from '../lib/hooks'
import { setLang, t } from '../lib/i18n'
import { Markdown } from '../lib/md'

const COMPACT_MIN = 120
const COMPACT_MAX = 440

const STATE_LABEL: Partial<Record<ConvState, string>> = {
  listening: 'Слушаю…',
  partial_transcript: 'Слушаю…',
  question_candidate: 'Возможный вопрос',
  question_confirmed: 'Вопрос',
  generating: 'Генерирую…',
  paused: 'Пауза — захват остановлен',
  stopped: 'Сессия не запущена',
  idle: 'Сессия не запущена'
}

function provenance(a: AnswerEvent | undefined): string {
  if (!a || !a.model) return ''
  const parts = [a.model]
  if (a.firstTokenMs != null) parts.push(`${(a.firstTokenMs / 1000).toFixed(1)} с`)
  if (a.status === 'done') parts.push(a.usageCostUsd == null ? t('Цена неизвестна') : a.usageCostUsd === 0 ? 'локально' : `$${a.usageCostUsd.toFixed(4)}`)
  return parts.join(' · ')
}

function codeBlocks(text: string): string[] {
  return [...text.matchAll(/```[\w+-]*\n([\s\S]*?)```/g)].map((m) => m[1].trimEnd())
}

export function Overlay() {
  const [init, setInit] = useState<{
    snap: AppSnapshot
    settings: Settings
  } | null>(null)
  useEffect(() => {
    void api.state().then((s) => setInit({ snap: s.snapshot, settings: s.settings }))
  }, [])
  const snap = useSnapshot(init?.snap ?? null)
  const [settings] = useSettingsFeed(init?.settings ?? null)
  const [tab, setTab] = useState<'answer' | 'code' | 'questions'>('answer')
  const body = useRef<HTMLDivElement>(null)
  const inner = useRef<HTMLDivElement>(null)
  const expandedNow = settings?.overlay.expanded ?? false
  const ready = !!(snap && settings)

  // Compact mode follows the content so the answer is never silently cut off; expanded keeps the user's size.
  useEffect(() => {
    const el = inner.current
    if (!el || expandedNow) return
    let raf = 0
    const ro = new ResizeObserver(() => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        const b = body.current
        if (!b) return
        const pad = b.offsetHeight - b.clientHeight + parseFloat(getComputedStyle(b).paddingTop) + parseFloat(getComputedStyle(b).paddingBottom)
        const want = Math.round(Math.min(COMPACT_MAX, Math.max(COMPACT_MIN, innerHeight - b.offsetHeight + el.offsetHeight + pad)))
        if (Math.abs(want - innerHeight) > 6) void api.overlay.fit(want)
      })
    })
    ro.observe(el)
    return () => {
      ro.disconnect()
      cancelAnimationFrame(raf)
    }
  }, [expandedNow, ready])

  useEffect(() => {
    if (!settings) return
    setLang(settings.uiLang)
    document.documentElement.dataset.theme = settings.overlay.theme
    document.documentElement.style.setProperty('--fs', String(settings.overlay.fontScale))
    document.documentElement.style.setProperty('--bg-alpha', String(settings.overlay.opacity))
  }, [settings])

  useEffect(() => km.onScroll((dir) => body.current?.scrollBy({ top: dir * 140, behavior: 'smooth' })), [])

  const a = snap?.answers ?? {}
  const say = a.say ?? a.screen
  const deep = a.deep
  const codes = useMemo(() => [...codeBlocks(deep?.text ?? ''), ...codeBlocks(a.screen?.text ?? '')], [deep?.text, a.screen?.text])

  if (!snap || !settings) return null
  const expanded = settings.overlay.expanded
  const q = snap.activeQuestion
  const live = snap.partial.remote || snap.partial.user
  const errorAns = [a.say, a.points, a.deep, a.screen].find((x) => x?.status === 'error' || x?.status === 'blocked')
  const points = (a.points?.text ?? '')
    .split('\n')
    .map((l) => l.replace(/^\s*[•\-*]\s*/, '').trim())
    .filter(Boolean)
    .slice(0, expanded ? 5 : 3)

  const toggleExpand = async () => {
    await api.overlay.expand(!expanded)
    await api.overlay.fit(expanded ? 230 : 560)
  }

  return (
    <div className={`ov ${expanded ? 'expanded' : ''}`}>
      <header className="ov-head">
        <span className={`dot ${snap.listening ? (snap.state === 'generating' ? 'busy' : 'ok') : snap.sessionId ? 'warn' : ''}`} />
        <span className="ov-state">{t(STATE_LABEL[snap.state] ?? (q ? 'Вопрос' : 'Слушаю…'))}</span>
        {snap.status.protection.state === 'ok' && (
          <span className="ov-shield" title={snap.status.protection.label}>
            ◈
          </span>
        )}
        <span className="grow" />
        <button className="ov-btn" title={t('Ответить сейчас')} onClick={() => void api.session.answerNow()}>
          ↵
        </button>
        <button className="ov-btn" title={t('Следующий вопрос')} onClick={() => void api.session.next()}>
          ⟳
        </button>
        <button className="ov-btn" title={expanded ? t('Свернуть') : t('Развернуть')} onClick={() => void toggleExpand()}>
          {expanded ? '▭' : '⤢'}
        </button>
        <button className="ov-btn" title="Скрыть" onClick={() => void api.overlay.toggle()}>
          ×
        </button>
      </header>

      {expanded && (
        <nav className="ov-tabs">
          <button className={tab === 'answer' ? 'on' : ''} onClick={() => setTab('answer')}>
            {t('Ответить')}
          </button>
          <button className={tab === 'code' ? 'on' : ''} onClick={() => setTab('code')}>
            {t('Код')} {codes.length ? `(${codes.length})` : ''}
          </button>
          <button className={tab === 'questions' ? 'on' : ''} onClick={() => setTab('questions')}>
            {t('Последние вопросы')}
          </button>
        </nav>
      )}

      <div className="ov-body" ref={body}>
        <div ref={inner}>
          {snap.budgetBlocked && (
            <div className="ov-alert">
              {snap.budgetBlocked}. Платные запросы остановлены.
              <button className="ov-link" onClick={() => void api.approveBudget()}>
                Продолжить сверх лимита
              </button>
            </div>
          )}

          {snap.candidates.length > 0 && !q && (
            <div className="ov-cand">
              <span className="faint">{t('Возможный вопрос')}:</span> {snap.candidates[snap.candidates.length - 1].text}
              <span className="row" style={{ marginTop: 6 }}>
                <button className="ov-link" onClick={() => void api.session.confirm(snap.candidates[snap.candidates.length - 1].questionId)}>
                  {t('Это вопрос')}
                </button>
                <button className="ov-link faint" onClick={() => void api.session.dismiss(snap.candidates[snap.candidates.length - 1].questionId)}>
                  {t('Нет')}
                </button>
              </span>
            </div>
          )}

          {tab === 'answer' || !expanded ? (
            <>
              {q && (
                <div className="ov-q" title={q.text}>
                  {q.source === 'remote' ? '❝ ' : ''}
                  {q.text}
                  {q.revision > 1 && <span className="ov-rev"> · уточнено</span>}
                </div>
              )}
              {!q && live && <div className="ov-q faint">{live}</div>}
              {say?.text ? (
                <div className="ov-say">
                  {say.kind === 'screen' ? <Markdown text={say.text} /> : say.text}
                  {say.status === 'streaming' && <span className="caret" />}
                </div>
              ) : q && (a.say?.status === 'streaming' || snap.state === 'generating') ? (
                <div className="ov-say faint">…</div>
              ) : null}
              {points.length > 0 && (
                <ul className="ov-points">
                  {points.map((p, i) => (
                    <li key={i}>{p}</li>
                  ))}
                </ul>
              )}
              {expanded && deep?.text && (
                <section className="ov-deep">
                  <Markdown text={deep.text} />
                </section>
              )}
              {expanded && q && !deep && (
                <button className="ov-link" onClick={() => void api.session.answerNow('deep')}>
                  {t('Подробнее')} →
                </button>
              )}
              {errorAns?.error && (
                <div className="ov-alert">
                  {errorAns.error.message}
                  {errorAns.error.detail ? <span className="faint"> — {errorAns.error.detail}</span> : null}
                </div>
              )}
              {snap.notice && <div className="ov-note">{snap.notice}</div>}
              {!q && !live && !snap.candidates.length && snap.sessionId && (
                <div className="faint ov-hint">
                  Жду вопрос. <kbd>{settings.shortcuts.answerNow.replace('Control', 'Ctrl')}</kbd> — ответить сразу.
                </div>
              )}
              {!snap.sessionId && <div className="faint ov-hint">{t('Сессия не запущена')}</div>}
            </>
          ) : tab === 'code' ? (
            codes.length ? (
              codes.map((c, i) => (
                <div key={i} className="ov-code">
                  <button className="ov-link" onClick={() => void api.copy(c)}>
                    Копировать
                  </button>
                  <pre>{c}</pre>
                </div>
              ))
            ) : (
              <div className="faint ov-hint">Код появится после «Подробнее» или снимка экрана с режимом «с кодом».</div>
            )
          ) : (
            <ul className="ov-recent">
              {snap.recentQuestions.map((r) => (
                <li key={r.questionId}>{r.text}</li>
              ))}
              {!snap.recentQuestions.length && <li className="faint">Пока пусто</li>}
            </ul>
          )}
        </div>
      </div>

      <footer className="ov-foot">
        <span className="faint grow">{provenance(say ?? a.points)}</span>
        {snap.cost.unknownPriced > 0 && <span className="faint">{t('Цена неизвестна')}</span>}
      </footer>
    </div>
  )
}
