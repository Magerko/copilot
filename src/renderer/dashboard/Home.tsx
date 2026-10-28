import { useState } from 'react'
import type { AppSnapshot, SessionStartOptions } from '@shared/types'
import { api } from '../lib/api'
import { useAsync } from '../lib/hooks'
import { t } from '../lib/i18n'
import type { Ctx } from './App'
import { fmtDate, Status } from './ui'

export function Home({ ctx, snap }: { ctx: Ctx; snap: AppSnapshot }) {
  const [mode, setMode] = useState<SessionStartOptions['mode']>('practice')
  const [preview] = useAsync(() => api.preview(), [ctx.settings.roles])
  const [sessions] = useAsync(() => api.history.list(), [snap.sessionId])
  const [profiles] = useAsync(() => api.profiles.list(), [])
  const st = snap.status
  const s = ctx.settings
  const noModel = !s.roles.quick_answer
  const noAsr = st.asr.state === 'warn' || (st.asr.state === 'error' && !snap.sessionId)
  const keys = s.shortcuts

  return (
    <div className="page col" style={{ gap: 18 }}>
      {snap.notice && !snap.sessionId && <div className="banner warn">{snap.notice}</div>}
      <section className="hero card">
        <div className="col grow" style={{ gap: 12 }}>
          <h1>{snap.sessionId ? 'Сессия идёт' : 'Готовы к разговору?'}</h1>
          <div className="row wrap" style={{ gap: 8 }}>
            {(
              [
                ['practice', 'Тренировка'],
                ['live', 'Интервью / звонок'],
                ['meeting', 'Встреча (только транскрипт)']
              ] as const
            ).map(([m, label]) => (
              <button key={m} className={`chip ${mode === m ? 'accent' : ''}`} onClick={() => setMode(m)} disabled={!!snap.sessionId}>
                {t(label)}
              </button>
            ))}
          </div>
          <div className="small muted">
            {mode === 'practice'
              ? 'Вопросы можно читать вслух самому или вводить текстом — подсказки на ваш голос тоже.'
              : mode === 'live'
                ? 'Подсказки только на речь собеседника (системный звук). Ваш голос — в транскрипт и контекст.'
                : 'Без подсказок: транскрипт встречи и вопросы сохраняются локально.'}
          </div>
          <div className="row wrap" style={{ gap: 10, marginTop: 4 }}>
            {snap.sessionId ? (
              <>
                <button className="btn big" onClick={() => ctx.go('live')}>
                  Открыть сессию
                </button>
                <button className="btn big" onClick={() => void api.session.stop()}>
                  {t('Завершить')}
                </button>
              </>
            ) : (
              <button className="btn primary big" disabled={noAsr && noModel} onClick={() => void api.session.start(mode)}>
                {t('Начать сессию')}
              </button>
            )}
            <select
              className="input"
              style={{ width: 220 }}
              value={s.activeProfileId}
              onChange={(e) => void ctx.patch({ activeProfileId: e.target.value })}
              disabled={!!snap.sessionId}
              aria-label="Профиль"
            >
              {(profiles ?? []).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          {(noModel || noAsr) && (
            <div className="banner warn small">
              {noAsr && (
                <div>
                  Распознавание речи не установлено.{' '}
                  <a href="#" onClick={() => ctx.go('settings', 'audio')}>
                    Установить
                  </a>{' '}
                  — или задавайте вопросы текстом.
                </div>
              )}
              {noModel && (
                <div>
                  Не выбрана модель для ответов.{' '}
                  <a href="#" onClick={() => ctx.go('settings', 'providers')}>
                    Подключить провайдера
                  </a>
                </div>
              )}
            </div>
          )}
        </div>
        <div className="hero-status col">
          <Status name={t('Микрофон')} st={st.mic} />
          <Status name={t('Звук собеседника')} st={st.system} />
          <Status name={t('Распознавание')} st={st.asr} />
          <Status name={t('Модель ответов')} st={st.llm} />
          <Status name={t('Изображения')} st={st.vision} />
          <Status name={t('Оверлей')} st={st.overlay} />
          <Status name={t('Защита экрана')} st={st.protection} />
          <Status name={t('Сеть')} st={st.network} />
        </div>
      </section>

      <div className="grid2">
        <section className="card col">
          <h2>{t('Что уходит провайдеру')}</h2>
          {preview?.recipients.length ? (
            <div className="col" style={{ gap: 6 }}>
              {preview.recipients.map((r) => (
                <div key={r.baseUrl} className="row small">
                  <span className={`chip ${r.local ? '' : 'accent'}`}>{r.local ? 'на этом ПК' : 'облако'}</span>
                  <b>{r.label}</b>
                  <span className="faint mono">{new URL(r.baseUrl).host}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="muted small">Провайдер не выбран — никуда.</div>
          )}
          <ul className="small muted" style={{ margin: 0, paddingLeft: 18 }}>
            {preview?.items.map((i) => (
              <li key={i}>{i}</li>
            ))}
          </ul>
        </section>

        <section className="card col">
          <h2>Горячие клавиши</h2>
          <div className="keys small">
            <span>Показать/скрыть подсказки</span>
            <kbd>{pretty(keys.toggleOverlay)}</kbd>
            <span>Ответить сейчас</span>
            <kbd>{pretty(keys.answerNow)}</kbd>
            <span>Пауза / продолжить</span>
            <kbd>{pretty(keys.toggleListen)}</kbd>
            <span>Снимок области экрана</span>
            <kbd>{pretty(keys.snapRegion)}</kbd>
            <span>Развернуть / подробно</span>
            <kbd>{pretty(keys.expand)}</kbd>
            <span>Аварийная остановка</span>
            <kbd>{pretty(keys.panic)}</kbd>
          </div>
        </section>
      </div>

      <section className="card col">
        <div className="row between">
          <h2>{t('Последние сессии')}</h2>
          <button className="btn ghost sm" onClick={() => ctx.go('history')}>
            Вся история →
          </button>
        </div>
        {sessions?.length ? (
          <div className="col" style={{ gap: 4 }}>
            {sessions.slice(0, 5).map((x) => (
              <div key={x.id} className="row small">
                <span className="faint" style={{ width: 110 }}>
                  {fmtDate(x.startedAt)}
                </span>
                <span className="grow">{x.title}</span>
                <span className="muted">{x.questions} вопр.</span>
                {x.status === 'interrupted' && <span className="chip">прервана</span>}
              </div>
            ))}
          </div>
        ) : (
          <div className="muted small">Пока нет. {s.history && s.consent.history ? '' : 'Сохранение истории выключено.'}</div>
        )}
      </section>
    </div>
  )
}

export function pretty(accel: string): string {
  return accel.replace('Control', 'Ctrl').replace(/\+/g, ' + ')
}
