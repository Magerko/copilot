import { useEffect, useState } from 'react'
import type { AsrStatus, Profile, ProviderConfig } from '@shared/types'
import { api, type ProviderTestReport } from '../lib/api'
import { useAsync, useSnapshot } from '../lib/hooks'
import { setLang, t } from '../lib/i18n'
import type { Ctx } from './App'
import { PRESET_LABEL } from './ProfilePage'
import { ASR_LANG_OPTIONS, AsrInstaller, DeviceSettings } from './settings/AudioTab'
import { ModelSelect, ProviderForm, TestResult } from './settings/Providers'
import { Toggle } from './ui'

const STEPS = ['Язык', 'Звук', 'Распознавание', 'Модель', 'Профиль', 'Проверка', 'Согласие']

export function Onboarding({ ctx, asr }: { ctx: Ctx; asr: AsrStatus | null }) {
  const [step, setStep] = useState(0)
  const started = useState(() => Date.now())[0]
  const next = () => setStep((s) => Math.min(STEPS.length - 1, s + 1))
  const back = () => setStep((s) => Math.max(0, s - 1))
  // I take capture consent from the user's explicit «Далее» on the audio step, for exactly the sources left switched on; «Пропустить» grants nothing.
  const accept = async () => {
    if (step === 1) await ctx.patch({ consent: { mic: ctx.settings.audio.captureMic, system: ctx.settings.audio.captureSystem } })
    next()
  }

  return (
    <div className="onb">
      <div className="onb-card card">
        <div className="row between">
          <div className="brand">
            <span className="brand-mark">
              C<i />
            </span>
            <span>Copilot</span>
          </div>
          <span className="faint small">
            Шаг {step + 1} из {STEPS.length}
          </span>
        </div>
        <div className="onb-steps">
          {STEPS.map((s, i) => (
            <span key={s} className={i === step ? 'on' : i < step ? 'done' : ''}>
              {t(s)}
            </span>
          ))}
        </div>
        <div className="onb-body">
          {step === 0 && <StepLang ctx={ctx} />}
          {step === 1 && <StepAudio ctx={ctx} />}
          {step === 2 && <StepAsr ctx={ctx} asr={asr} />}
          {step === 3 && <StepModel ctx={ctx} />}
          {step === 4 && <StepProfile ctx={ctx} />}
          {step === 5 && <StepTest ctx={ctx} />}
          {step === 6 && <StepConsent ctx={ctx} started={started} />}
        </div>
        <div className="row">
          {step > 0 && (
            <button className="btn ghost" onClick={back}>
              {t('Назад')}
            </button>
          )}
          <span className="grow" />
          {step < STEPS.length - 1 && (
            <>
              {step > 0 && (
                <button className="btn ghost" onClick={next}>
                  {t('Пропустить')}
                </button>
              )}
              <button className="btn primary" onClick={() => void accept()}>
                {t('Далее')}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function StepLang({ ctx }: { ctx: Ctx }) {
  return (
    <div className="col" style={{ gap: 16 }}>
      <h1>{t('Добро пожаловать в Copilot')}</h1>
      <p className="muted" style={{ margin: 0 }}>
        Помощник слушает разговор, вовремя замечает вопрос и показывает короткий ответ с опорой на ваше резюме. Распознавание речи — на этом компьютере, модель
        для ответов вы выбираете сами.
      </p>
      <div className="grid2">
        <label className="field">
          <span>Язык интерфейса</span>
          <select
            className="input"
            value={ctx.settings.uiLang}
            onChange={(e) => {
              setLang(e.target.value as 'ru')
              void ctx.patch({ uiLang: e.target.value as 'ru', asr: { language: e.target.value as 'ru' } })
            }}
          >
            <option value="ru">Русский</option>
            <option value="uk">Українська</option>
            <option value="en">English</option>
          </select>
        </label>
        <label className="field">
          <span>Язык ответов</span>
          <select className="input" value={ctx.settings.answerLang} onChange={(e) => void ctx.patch({ answerLang: e.target.value as 'auto' })}>
            <option value="auto">Как в вопросе</option>
            <option value="ru">Русский</option>
            <option value="uk">Українська</option>
            <option value="en">English</option>
          </select>
        </label>
        <label className="field">
          <span>Язык разговора</span>
          <select className="input" value={ctx.settings.asr.language} onChange={(e) => void ctx.patch({ asr: { language: e.target.value as 'auto' } })}>
            {ASR_LANG_OPTIONS}
          </select>
        </label>
      </div>
      <div className="small faint">Займёт около 3 минут. Любой шаг можно пропустить и настроить позже.</div>
    </div>
  )
}

function StepAudio({ ctx }: { ctx: Ctx }) {
  return (
    <div className="col" style={{ gap: 14 }}>
      <h2>Звук: вы и собеседник — раздельно</h2>
      <p className="muted small" style={{ margin: 0 }}>
        Микрофон — это вы. Системный звук — голос собеседника из Zoom, Meet, Teams или браузера. Подсказки строятся по речи собеседника.
      </p>
      <DeviceSettings ctx={ctx} />
    </div>
  )
}

function StepAsr({ ctx, asr }: { ctx: Ctx; asr: AsrStatus | null }) {
  return (
    <div className="col" style={{ gap: 14 }}>
      <h2>Распознавание речи</h2>
      <p className="muted small" style={{ margin: 0 }}>
        Работает локально (whisper.cpp): аудио не покидает компьютер. Нужно один раз скачать движок и модель — размер и проверка контрольной суммы показаны
        ниже.
      </p>
      <AsrInstaller ctx={ctx} asr={asr} compact />
      <div className="small faint">Без распознавания можно вводить вопросы текстом.</div>
    </div>
  )
}

function StepModel({ ctx }: { ctx: Ctx }) {
  const [providers, reload] = useAsync(() => api.providers.list(), [])
  const [adding, setAdding] = useState(false)
  const [test, setTest] = useState<ProviderTestReport | null>(null)
  const [busy, setBusy] = useState(false)
  const quick = ctx.settings.roles.quick_answer
  const p = providers?.find((x) => x.id === quick?.providerId) ?? providers?.[0]

  const choose = async (prov: ProviderConfig, model: string) => {
    await ctx.patch({
      roles: { quick_answer: { providerId: prov.id, model }, deep_answer: { providerId: prov.id, model }, vision: { providerId: prov.id, model } }
    })
    setTest(null)
  }

  return (
    <div className="col" style={{ gap: 14 }}>
      <h2>Модель для ответов</h2>
      <p className="muted small" style={{ margin: 0 }}>
        Свой ключ (BYOK) или локальная модель. Ollama работает без интернета и без ключа.
      </p>
      {(!providers?.length || adding) && (
        <ProviderForm
          presets={ctx.init.presets}
          onSaved={() => {
            setAdding(false)
            reload()
          }}
          onCancel={providers?.length ? () => setAdding(false) : undefined}
        />
      )}
      {p && !adding && (
        <div className="col">
          <div className="row">
            <b className="grow">{p.label}</b>
            <button className="btn sm ghost" onClick={() => setAdding(true)}>
              Другой провайдер
            </button>
          </div>
          <ModelSelect providerId={p.id} value={quick?.providerId === p.id ? quick.model : ''} onChange={(m) => void choose(p, m)} />
          <button
            className="btn"
            disabled={!quick?.model || busy}
            onClick={async () => {
              setBusy(true)
              try {
                setTest(await api.providers.test(quick!.providerId, quick!.model))
              } finally {
                setBusy(false)
              }
            }}
          >
            {busy ? 'Проверяю текст и изображение…' : 'Проверить соединение'}
          </button>
          <TestResult r={test} />
          {test?.vision && !test.vision.ok && (
            <div className="small muted">Снимки экрана будут распознаваться локальным OCR. Отдельную vision-модель можно выбрать в настройках.</div>
          )}
        </div>
      )}
    </div>
  )
}

function StepProfile({ ctx }: { ctx: Ctx }) {
  const [profiles, reload] = useAsync(() => api.profiles.list(), [])
  const [docs, reloadDocs] = useAsync(() => api.knowledge.list(ctx.settings.activeProfileId), [ctx.settings.activeProfileId])
  const [err, setErr] = useState<string | null>(null)
  const p = profiles?.find((x) => x.id === ctx.settings.activeProfileId) ?? profiles?.[0]
  if (!p) return null
  const setPreset = async (preset: Profile['preset']) => {
    await api.profiles.upsert({ ...p, preset })
    reload()
  }
  return (
    <div className="col" style={{ gap: 14 }}>
      <h2>Профиль</h2>
      <div className="preset-grid">
        {(Object.keys(PRESET_LABEL) as Profile['preset'][]).map((k) => (
          <button key={k} className={`preset ${p.preset === k ? 'on' : ''}`} onClick={() => void setPreset(k)}>
            <b>{PRESET_LABEL[k]}</b>
          </button>
        ))}
      </div>
      <div className="row">
        <button
          className="btn"
          onClick={async () => {
            setErr(null)
            try {
              await api.knowledge.import(p.id, 'cv')
              reloadDocs()
            } catch (e) {
              setErr((e as Error).message)
            }
          }}
        >
          Загрузить резюме (PDF/DOCX/TXT)
        </button>
        <button
          className="btn ghost"
          onClick={async () => {
            await api.knowledge.import(p.id, 'jd').catch((e: Error) => setErr(e.message))
            reloadDocs()
          }}
        >
          Описание вакансии
        </button>
      </div>
      {err && <div className="banner error small">{err}</div>}
      {docs?.map((d) => (
        <div key={d.id} className="small">
          ✓ {d.name} — {d.chunks} фрагм.
        </div>
      ))}
      <div className="small muted">Ответы о вашем опыте строятся только на загруженных фактах. Чего нет в резюме, приложение не придумывает.</div>
    </div>
  )
}

function StepTest({ ctx }: { ctx: Ctx }) {
  const snap = useSnapshot(ctx.init.snapshot)
  const [typed, setTyped] = useState('')
  const [left, setLeft] = useState<number | null>(null)
  useEffect(() => {
    if (left === null || left <= 0) return
    const id = setTimeout(() => setLeft((l) => (l ?? 1) - 1), 1000)
    return () => clearTimeout(id)
  }, [left])
  useEffect(() => {
    if (left === 0) void api.session.stop()
  }, [left])
  useEffect(
    () => () => {
      void api.session.stop()
    },
    []
  )
  const a = snap?.answers.say
  return (
    <div className="col" style={{ gap: 14 }}>
      <h2>Проверка за 30 секунд</h2>
      <p className="muted small" style={{ margin: 0 }}>
        Нажмите «Начать» и задайте вопрос вслух, например: «Что такое идемпотентность в REST?» — или введите его. Появится окно подсказок.
      </p>
      <div className="row">
        <button
          className="btn primary"
          disabled={left !== null && left > 0}
          onClick={async () => {
            await api.session.start('practice')
            setLeft(30)
          }}
        >
          {left && left > 0 ? `Идёт проверка… ${left} с` : 'Начать'}
        </button>
        <input
          className="input grow"
          placeholder={t('Задать вопрос текстом')}
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && typed.trim() && (void api.session.askTyped(typed), setTyped(''))}
        />
      </div>
      {snap && (
        <div className="card col" style={{ background: 'var(--surface-2)' }}>
          <div className="small muted">Распознано: {snap.partial.user || snap.segments.at(-1)?.text || '—'}</div>
          {snap.activeQuestion && <b>{snap.activeQuestion.text}</b>}
          {a && (
            <div style={{ fontSize: 17 }}>
              {a.text || '…'}
              {a.firstTokenMs != null && (
                <div className="faint small">
                  {a.provider} · {a.model} · первый токен {(a.firstTokenMs / 1000).toFixed(1)} с
                </div>
              )}
              {a.error && (
                <div className="banner error small">
                  {a.error.message} {a.error.detail}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function StepConsent({ ctx, started }: { ctx: Ctx; started: number }) {
  const c = ctx.settings.consent
  const [agree, setAgree] = useState(c.participants)
  const finish = async () => {
    const quick = ctx.settings.roles.quick_answer
    const local = quick
      ? ctx.init.presets && (await api.providers.list()).some((p) => p.id === quick.providerId && /127\.0\.0\.1|localhost/.test(p.baseUrl))
      : false
    await ctx.patch({
      onboarded: true,
      autoAnswer: local,
      consent: { ...c, participants: true, acceptedAt: Date.now() }
    })
  }
  return (
    <div className="col" style={{ gap: 14 }}>
      <h2>Последнее: согласие и честность</h2>
      <div className="banner">
        Записывать звук и использовать AI-подсказки можно только там, где это разрешено правилами и участники согласны. Copilot не обходит прокторинг и средства
        контроля и не обещает невидимости.
      </div>
      <Toggle
        on={c.history}
        onChange={(v) => void ctx.patch({ consent: { history: v } })}
        label="Сохранять историю сессий на этом компьютере"
        hint="Можно удалить в любой момент. Без истории нет восстановления после сбоя."
      />
      <Toggle on={c.screen} onChange={(v) => void ctx.patch({ consent: { screen: v } })} label="Разрешить снимки экрана по моей команде" />
      <Toggle
        on={c.cloud}
        onChange={(v) => void ctx.patch({ consent: { cloud: v } })}
        label="Разрешить отправку в облачную модель"
        hint="Нужно, только если модель для ответов — не на этом компьютере. Уходит вопрос, недавний транскрипт и подходящие фрагменты документов."
      />
      <label className="row">
        <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
        <span>Я понимаю и буду сообщать участникам о записи и AI-обработке</span>
      </label>
      <div className="row">
        <span className="faint small grow">Настройка заняла {Math.max(1, Math.round((Date.now() - started) / 60000))} мин.</span>
        <button className="btn primary" disabled={!agree} onClick={() => void finish()}>
          {t('Готово')}
        </button>
      </div>
    </div>
  )
}
