import { useEffect, useMemo, useRef, useState } from 'react'
import type { AnswerEvent, AppSnapshot, ComponentStatus, ConvState, Settings } from '@shared/types'
import { api, km } from '../lib/api'
import { useSettingsFeed, useSnapshot } from '../lib/hooks'
import { setLang, t } from '../lib/i18n'
import { pretty } from '../lib/keys'
import { Markdown } from '../lib/md'

const COMPACT_MIN = 120

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
  if (a.firstTokenMs != null) parts.push(t('{s} с', { s: (a.firstTokenMs / 1000).toFixed(1) }))
  if (a.status === 'done') parts.push(a.usageCostUsd == null ? t('Цена неизвестна') : a.usageCostUsd === 0 ? t('локально') : `$${a.usageCostUsd.toFixed(4)}`)
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
  const chipRow = useRef<HTMLDivElement>(null)
  const expandedNow = settings?.overlay.expanded ?? false
  const cap = settings?.overlay.size.height ?? 440
  const ready = !!(snap && settings)

  // I make compact mode follow the content so the answer is never silently cut off; expanded keeps the user's size.
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
        const want = Math.round(Math.min(cap, Math.max(COMPACT_MIN, innerHeight - b.offsetHeight + el.offsetHeight + pad)))
        if (Math.abs(want - innerHeight) > 6) void api.overlay.fit(want)
      })
    })
    ro.observe(el)
    return () => {
      ro.disconnect()
      cancelAnimationFrame(raf)
    }
  }, [expandedNow, ready, cap])

  useEffect(() => {
    if (!settings) return
    document.documentElement.dataset.theme = settings.overlay.theme
  }, [settings])

  // The newest phrase is on the right; I keep it in view as the transcript grows.
  const chipKey = snap ? `${snap.segments.at(-1)?.segmentId ?? ''}|${snap.partial.remote ?? ''}|${snap.partial.user ?? ''}` : ''
  useEffect(() => {
    const el = chipRow.current
    if (el) el.scrollLeft = el.scrollWidth
  }, [chipKey])

  useEffect(() => km.onScroll((dir) => body.current?.scrollBy({ top: dir * 140, behavior: 'smooth' })), [])

  const a = snap?.answers ?? {}
  const say = a.say ?? a.screen
  const deep = a.deep
  const codes = useMemo(() => [...codeBlocks(deep?.text ?? ''), ...codeBlocks(a.screen?.text ?? '')], [deep?.text, a.screen?.text])

  if (!snap || !settings) return null
  // t() is not reactive, so the language has to be set before this render's labels are built, not in an effect.
  setLang(settings.uiLang)
  const expanded = settings.overlay.expanded
  const q = snap.activeQuestion
  const live = snap.partial.remote || snap.partial.user
  const errorAns = [a.say, a.points, a.deep, a.screen].find((x) => x?.status === 'error' || x?.status === 'blocked')
  const points = (a.points?.text ?? '')
    .split('\n')
    .map((l) => l.replace(/^\s*[•\-*]\s*/, '').trim())
    .filter(Boolean)
    .slice(0, expanded ? 5 : 3)

  const toggleExpand = () => void api.overlay.expand(!expanded)
  const keys = settings.shortcuts
  const chips = [
    ...snap.segments.slice(-4).map((x) => ({ id: x.segmentId, text: x.text, source: x.source })),
    ...(live ? [{ id: 'live', text: live, source: 'remote' as const }] : [])
  ]
  const style = { '--fs': String(settings.overlay.fontScale), '--bg-alpha': String(settings.overlay.opacity) } as React.CSSProperties

  return (
    <div className={`ov ${expanded ? 'expanded' : ''}`} style={style}>
      <header className="ov-bar">
        <SourceToggle
          kind="system"
          on={settings.audio.captureSystem}
          status={snap.status.system}
          onClick={() => void api.patchSettings({ audio: { captureSystem: !settings.audio.captureSystem } })}
        />
        <SourceToggle
          kind="mic"
          on={settings.audio.captureMic}
          status={snap.status.mic}
          onClick={() => void api.patchSettings({ audio: { captureMic: !settings.audio.captureMic } })}
        />
        {snap.sessionId ? (
          <button
            className={`ov-rec ${snap.listening ? 'on' : ''}`}
            title={snap.listening ? t('Пауза') : t('Продолжить')}
            onClick={() => void api.session.toggleListen()}
          >
            <span className={`dot ${snap.listening ? (snap.state === 'generating' ? 'busy' : 'ok') : 'warn'}`} />
            {snap.listening ? <Kbd k={keys.toggleListen} /> : t('Пауза')}
          </button>
        ) : (
          <button className="ov-pill primary" onClick={() => void api.session.start('live')}>
            {t('Начать')}
          </button>
        )}
        <button className="ov-pill" onClick={() => void api.session.answerNow()} disabled={!snap.sessionId}>
          {t('Ответить')} <Kbd k={keys.answerNow} />
        </button>
        <button className="ov-pill" onClick={() => void api.screen.begin()}>
          {t('Снимок')} <Kbd k={keys.snapRegion} />
        </button>
        <button className="ov-pill" onClick={toggleExpand}>
          {expanded ? t('Свернуть') : t('Подробнее')} <Kbd k={keys.expand} />
        </button>
        <span className="grow" />
        {snap.status.protection.state === 'ok' && (
          <span className="ov-shield" title={snap.status.protection.label}>
            ◈
          </span>
        )}
        {snap.startedAt && <Timer since={snap.startedAt} />}
        <button className="ov-icon" title={t('Скрыть')} onClick={() => void api.overlay.toggle()}>
          ×
        </button>
        {snap.sessionId && (
          <button className="ov-pill danger" onClick={() => void api.session.stop()}>
            {t('Стоп')}
          </button>
        )}
      </header>

      {chips.length > 0 && (
        <div className="ov-chips" ref={chipRow}>
          {chips.map((c) => (
            <button
              key={c.id}
              className={`ov-chip ${c.source === 'user' ? 'me' : ''} ${c.id === 'live' ? 'live' : ''}`}
              title={t('Ответить на эту фразу')}
              onClick={() => void api.session.askTyped(c.text)}
            >
              {c.text}
            </button>
          ))}
        </div>
      )}

      <section className="ov-card">
        <div className="ov-card-head">
          <span className={`ov-state ${snap.state === 'generating' ? 'busy' : ''}`}>{t(STATE_LABEL[snap.state] ?? (q ? 'Вопрос' : 'Слушаю…'))}</span>
          <span className="grow" />
          <button
            className={`ov-pill sm ${settings.autoAnswer ? 'on' : ''}`}
            title={t('Отвечать автоматически на распознанный вопрос')}
            onClick={() => void api.patchSettings({ autoAnswer: !settings.autoAnswer })}
          >
            <span className={`dot ${settings.autoAnswer ? 'ok' : ''}`} /> {t('Авто-ответ')}
          </button>
          <button className="ov-pill sm" title={t('Следующий вопрос')} onClick={() => void api.session.next()} disabled={!q && !say}>
            {t('Очистить')}
          </button>
        </div>

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
                {snap.budgetBlocked}. {t('Платные запросы остановлены.')}
                <button className="ov-link" onClick={() => void api.approveBudget()}>
                  {t('Продолжить сверх лимита')}
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
                    <b className="ov-label">💬 {t('Вопрос')}:</b> {q.text}
                    {q.revision > 1 && <span className="ov-rev"> · {t('уточнено')}</span>}
                    <button className="ov-copy" title={t('Копировать')} onClick={() => void api.copy(q.text)}>
                      ⧉
                    </button>
                  </div>
                )}
                {say?.text ? (
                  <div className="ov-say">
                    <b className="ov-label">⭐ {t('Ответ')}:</b> {say.kind === 'screen' ? <Markdown text={say.text} /> : say.text}
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
                {!q && !snap.candidates.length && snap.sessionId && (
                  <div className="faint ov-hint">
                    {t('Жду вопрос.')} <kbd>{pretty(keys.answerNow)}</kbd> {t('— ответить сразу, или нажмите на фразу выше.')}
                  </div>
                )}
                {!snap.sessionId && <div className="faint ov-hint">{t('Сессия не запущена')}</div>}
              </>
            ) : tab === 'code' ? (
              codes.length ? (
                codes.map((c, i) => (
                  <div key={i} className="ov-code">
                    <button className="ov-link" onClick={() => void api.copy(c)}>
                      {t('Копировать')}
                    </button>
                    <pre>{c}</pre>
                  </div>
                ))
              ) : (
                <div className="faint ov-hint">{t('Код появится после «Подробнее» или снимка экрана с режимом «с кодом».')}</div>
              )
            ) : (
              <ul className="ov-recent">
                {snap.recentQuestions.map((r) => (
                  <li key={r.questionId}>{r.text}</li>
                ))}
                {!snap.recentQuestions.length && <li className="faint">{t('Пока пусто')}</li>}
              </ul>
            )}
          </div>
        </div>

        <footer className="ov-foot">
          <span className="faint grow">{provenance(say ?? a.points)}</span>
          {snap.cost.unknownPriced > 0 && <span className="faint">{t('Цена неизвестна')}</span>}
        </footer>
      </section>
    </div>
  )
}

/** Red while that source is actually being captured; crossed out when the user turned it off. */
function SourceToggle({ kind, on, status, onClick }: { kind: 'mic' | 'system'; on: boolean; status: ComponentStatus; onClick: () => void }) {
  const live = on && status.state === 'ok'
  const trouble = on && (status.state === 'error' || status.state === 'warn')
  const name = kind === 'mic' ? t('Микрофон') : t('Звук компьютера')
  const title = `${name}: ${on ? status.label || t('включён') : t('выключен — не распознаётся')}`
  return (
    <button className={`ov-src ${live ? 'live' : ''} ${on ? '' : 'off'} ${trouble ? 'trouble' : ''}`} title={title} aria-pressed={on} onClick={onClick}>
      {kind === 'mic' ? (
        <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
          <rect x="9" y="3" width="6" height="11" rx="3" fill="none" stroke="currentColor" strokeWidth="1.8" />
          <path d="M6 11a6 6 0 0 0 12 0M12 17v4M9 21h6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
          <rect x="3" y="4" width="18" height="12" rx="2" fill="none" stroke="currentColor" strokeWidth="1.8" />
          <path d="M8 20h8M12 16v4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      )}
      {live && <span className="ov-src-dot" />}
    </button>
  )
}

function Kbd({ k }: { k: string }) {
  return <kbd className="ov-kbd">{pretty(k)}</kbd>
}

function Timer({ since }: { since: number }) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])
  const sec = Math.max(0, Math.floor((now - since) / 1000))
  const mm = String(Math.floor(sec / 60)).padStart(2, '0')
  const ss = String(sec % 60).padStart(2, '0')
  return (
    <span className="ov-timer">
      {sec >= 3600 ? `${Math.floor(sec / 3600)}:` : ''}
      {mm}:{ss}
    </span>
  )
}
