import { useEffect, useRef, useState } from 'react'
import type { AnswerEvent, AppSnapshot } from '@shared/types'
import { api } from '../lib/api'
import { t } from '../lib/i18n'
import { pretty } from '../lib/keys'
import { Markdown } from '../lib/md'
import type { Ctx } from './App'
import { Meter } from './ui'

function Prov({ a }: { a?: AnswerEvent }) {
  if (!a?.model) return null
  return (
    <div className="faint small">
      {a.provider} · {a.model}
      {a.firstTokenMs != null && ` · первый токен ${(a.firstTokenMs / 1000).toFixed(1)} с`}
      {a.status === 'done' &&
        (a.usageCostUsd == null ? ` · ${t('Цена неизвестна')}` : a.usageCostUsd === 0 ? ' · локально, бесплатно' : ` · $${a.usageCostUsd.toFixed(4)}`)}
      {a.usage && !a.usage.exact && ' · токены оценочно'}
    </div>
  )
}

export function Live({ ctx, snap }: { ctx: Ctx; snap: AppSnapshot }) {
  const [typed, setTyped] = useState('')
  const [editing, setEditing] = useState<string | null>(null)
  const tr = useRef<HTMLDivElement>(null)
  const q = snap.activeQuestion
  const a = snap.answers

  useEffect(() => {
    tr.current?.scrollTo({ top: tr.current.scrollHeight })
  }, [snap.segments.length, snap.partial.remote, snap.partial.user])

  const ask = () => {
    if (!typed.trim()) return
    void api.session.askTyped(typed)
    setTyped('')
  }

  return (
    <div className="page live">
      <div className="live-bar card row wrap">
        {snap.sessionId ? (
          <>
            <button className="btn primary" onClick={() => void api.session.answerNow()} title={pretty(ctx.settings.shortcuts.answerNow)}>
              {t('Ответить сейчас')}
            </button>
            <button className="btn" onClick={() => void api.session.answerNow('deep')} disabled={!q}>
              {t('Подробнее')}
            </button>
            <button className="btn" onClick={() => void api.session.next()}>
              {t('Следующий вопрос')}
            </button>
            <button className="btn" onClick={() => void api.screen.begin()}>
              {t('Снимок экрана')}
            </button>
            <span className="grow" />
            <div className="levels">
              <span className="small muted">Я</span>
              <Meter value={snap.levels.user} />
              <span className="small muted">Собеседник</span>
              <Meter value={snap.levels.remote} />
            </div>
            <button className="btn" onClick={() => void api.session.toggleListen()}>
              {snap.listening ? t('Пауза') : t('Продолжить')}
            </button>
            <button className="btn" onClick={() => void api.session.stop()}>
              {t('Завершить')}
            </button>
          </>
        ) : (
          <>
            <span className="muted">{t('Сессия не запущена')}.</span>
            <button className="btn primary" onClick={() => void api.session.start('practice')}>
              {t('Тренировка')}
            </button>
            <button className="btn" onClick={() => void api.session.start('live')}>
              {t('Интервью / звонок')}
            </button>
          </>
        )}
        <button className="btn ghost" onClick={() => void api.overlay.toggle()}>
          {t('Оверлей')}
        </button>
      </div>

      <div className="live-grid">
        <section className="card col transcript">
          <div className="row between">
            <h2>Транскрипт</h2>
            <span className="faint small">локально · последние {ctx.settings.contextWindowMin} мин идут в контекст</span>
          </div>
          <div className="scroll tr-list" ref={tr}>
            {snap.segments.map((s) => (
              <div key={s.segmentId} className={`tr ${s.source}`}>
                <span className="tr-who">{s.source === 'remote' ? 'Собеседник' : 'Я'}</span>
                <span>{s.text}</span>
              </div>
            ))}
            {(['remote', 'user'] as const).map((src) =>
              snap.partial[src] ? (
                <div key={src} className={`tr ${src} partial`}>
                  <span className="tr-who">{src === 'remote' ? 'Собеседник' : 'Я'}</span>
                  <span>{snap.partial[src]}</span>
                </div>
              ) : null
            )}
            {!snap.segments.length && !snap.partial.remote && !snap.partial.user && (
              <div className="faint small">
                {snap.sessionId ? (snap.listening ? 'Слушаю… Говорите или включите звук собеседника.' : 'Пауза.') : 'Здесь появится распознанная речь.'}
              </div>
            )}
          </div>
          <div className="row">
            <input
              className="input grow"
              placeholder={t('Задать вопрос текстом')}
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && ask()}
            />
            <button className="btn" onClick={ask} disabled={!typed.trim()}>
              {t('Отправить')}
            </button>
          </div>
        </section>

        <section className="card col answer">
          {snap.budgetBlocked && (
            <div className="banner error row between">
              <span>{snap.budgetBlocked}. Новые платные запросы остановлены до вашего решения.</span>
              <button className="btn sm" onClick={() => void api.approveBudget()}>
                Продолжить сверх лимита
              </button>
            </div>
          )}
          {snap.notice && <div className="banner small">{snap.notice}</div>}
          {snap.candidates.map((c) => (
            <div key={c.questionId} className="banner warn row between">
              <span>
                <span className="muted">{t('Возможный вопрос')}:</span> {c.text}
              </span>
              <span className="row">
                <button className="btn sm" onClick={() => void api.session.confirm(c.questionId)}>
                  {t('Это вопрос')}
                </button>
                <button className="btn sm ghost" onClick={() => void api.session.dismiss(c.questionId)}>
                  {t('Нет')}
                </button>
              </span>
            </div>
          ))}

          {q ? (
            <>
              <div className="col" style={{ gap: 4 }}>
                <div className="row between">
                  <span className="small muted">
                    {t('Вопрос')} {q.revision > 1 ? `· ревизия ${q.revision}` : ''} · {q.source === 'remote' ? 'собеседник' : 'вы'} · {q.kind}
                  </span>
                  {editing === null ? (
                    <button className="btn ghost sm" onClick={() => setEditing(q.text)} title="Если распознано неверно">
                      Исправить
                    </button>
                  ) : null}
                </div>
                {editing !== null ? (
                  <div className="row">
                    <input
                      className="input grow"
                      value={editing}
                      onChange={(e) => setEditing(e.target.value)}
                      autoFocus
                      onKeyDown={(e) => e.key === 'Enter' && (void api.session.edit(editing), setEditing(null))}
                    />
                    <button className="btn sm" onClick={() => (void api.session.edit(editing), setEditing(null))}>
                      Ответить на исправленный
                    </button>
                    <button className="btn sm ghost" onClick={() => setEditing(null)}>
                      {t('Отмена')}
                    </button>
                  </div>
                ) : (
                  <h2 className="q-text">{q.text}</h2>
                )}
              </div>

              {(a.say || a.screen) && (
                <div className="ans-say">
                  {a.screen ? <Markdown text={a.screen.text} /> : a.say!.text || '…'}
                  <Prov a={a.screen ?? a.say} />
                  {(a.say ?? a.screen)?.error && (
                    <div className="banner error small">
                      {(a.say ?? a.screen)!.error!.message} {(a.say ?? a.screen)!.error!.detail}
                    </div>
                  )}
                </div>
              )}
              {a.points && (
                <div>
                  <h3 className="muted">{t('Тезисы')}</h3>
                  <Markdown text={a.points.text || '…'} />
                  {a.points.error && <div className="banner error small">{a.points.error.message}</div>}
                </div>
              )}
              {a.deep && (
                <div>
                  <h3 className="muted">{t('Подробнее')}</h3>
                  <Markdown text={a.deep.text || '…'} />
                  <Prov a={a.deep} />
                  {a.deep.error && <div className="banner error small">{a.deep.error.message}</div>}
                </div>
              )}
              {snap.state === 'question_confirmed' && !a.say && (
                <div className="banner">
                  Вопрос распознан. Автоответ выключен —{' '}
                  <button className="btn sm primary" onClick={() => void api.session.answerNow()}>
                    {t('Ответить')}
                  </button>{' '}
                  или <kbd>{pretty(ctx.settings.shortcuts.answerNow)}</kbd>
                </div>
              )}
            </>
          ) : (
            <div className="empty muted">
              <div style={{ fontSize: 34, marginBottom: 6 }}>❝</div>
              {snap.sessionId ? 'Как только прозвучит вопрос — здесь появится ответ.' : 'Начните сессию или задайте вопрос текстом слева.'}
            </div>
          )}

          <div className="grow" />
          <div className="faint small row between">
            <span>
              Расход сессии: {snap.cost.usd == null ? '—' : `$${snap.cost.usd.toFixed(4)}`} · запросов {snap.cost.requests}
              {snap.cost.unknownPriced > 0 && ` · ${snap.cost.unknownPriced} без цены (лимит $ для них не контролируется)`}
            </span>
          </div>
        </section>
      </div>

      {snap.recentQuestions.length > 0 && (
        <section className="card">
          <h3 className="muted" style={{ marginBottom: 6 }}>
            {t('Последние вопросы')}
          </h3>
          <div className="col small" style={{ gap: 2 }}>
            {snap.recentQuestions.map((r) => (
              <div key={r.questionId}>· {r.text}</div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
