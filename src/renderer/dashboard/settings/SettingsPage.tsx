import { useState } from 'react'
import type { AppSnapshot, AsrStatus, DiagReport, ShortcutAction } from '@shared/types'
import { api, isMac } from '../../lib/api'
import { useAsync } from '../../lib/hooks'
import { t } from '../../lib/i18n'
import { pretty, toAccelerator } from '../../lib/keys'
import type { Ctx } from '../App'
import { ErrorText, fmtDate, Section, Toggle } from '../ui'
import { AudioTab } from './AudioTab'
import { ProvidersTab } from './Providers'

const TABS = [
  ['providers', 'Провайдеры'],
  ['audio', 'Речь и звук'],
  ['overlay', 'Подсказки'],
  ['shortcuts', 'Горячие клавиши'],
  ['privacy', 'Приватность'],
  ['usage', 'Расходы'],
  ['diagnostics', 'Диагностика']
] as const

export function SettingsPage({ ctx, snap, asr, tab }: { ctx: Ctx; snap: AppSnapshot; asr: AsrStatus | null; tab?: string }) {
  const [cur, setCur] = useState<string>(tab ?? 'providers')
  return (
    <div className="page col" style={{ gap: 16 }}>
      <h1>{t('Настройки')}</h1>
      <nav className="tabs">
        {TABS.map(([id, label]) => (
          <button key={id} className={cur === id ? 'on' : ''} onClick={() => setCur(id)}>
            {t(label)}
          </button>
        ))}
      </nav>
      {cur === 'providers' && <ProvidersTab ctx={ctx} />}
      {cur === 'audio' && <AudioTab ctx={ctx} asr={asr} />}
      {cur === 'overlay' && <OverlayTab ctx={ctx} snap={snap} />}
      {cur === 'shortcuts' && <ShortcutsTab ctx={ctx} />}
      {cur === 'privacy' && <PrivacyTab ctx={ctx} />}
      {cur === 'usage' && <UsageTab ctx={ctx} snap={snap} />}
      {cur === 'diagnostics' && <DiagnosticsTab />}
    </div>
  )
}

function OverlayTab({ ctx, snap }: { ctx: Ctx; snap: AppSnapshot }) {
  const o = ctx.settings.overlay
  return (
    <div className="col" style={{ gap: 16 }}>
      <Section
        title={t('Окно подсказок')}
        aside={
          <div className="row">
            <button
              className="btn sm"
              title={t('Окно 400×550 по центру сверху, прямо под камерой, шрифт 110% — как телесуфлер')}
              onClick={() => void api.overlay.underCamera()}
            >
              {t('Поставить под камеру')}
            </button>
            <button className="btn sm" onClick={() => void api.overlay.toggle()}>
              {t('Показать / скрыть')}
            </button>
          </div>
        }
      >
        <div className="grid2">
          <label className="field">
            <span>{t('Формат подсказки')}</span>
            <select className="input" value={ctx.settings.answerFormat} onChange={(e) => void ctx.patch({ answerFormat: e.target.value as 'text' | 'cues' })}>
              <option value="text">{t('Готовый текст и тезисы')}</option>
              <option value="cues">{t('Опорные тезисы (3–5 ключевых слов)')}</option>
            </select>
            <span className="small faint">
              {ctx.settings.answerFormat === 'cues'
                ? t('Например: «регрессионное → после каждого релиза → автоматизация в CI». Отвечаете своими словами, тезисы только напоминают структуру.')
                : t('Готовая фраза, которую можно произнести, и список тезисов под ней.')}
            </span>
          </label>
          <span />
          <label className="field">
            <span>{t('Непрозрачность фона: {n}%', { n: Math.round(o.opacity * 100) })}</span>
            <input
              type="range"
              min={0.15}
              max={1}
              step={0.02}
              value={o.opacity}
              onChange={(e) => void ctx.patch({ overlay: { opacity: Number(e.target.value) } })}
            />
            <span className="small faint">{t('Фон окна подсказок просвечивает, текст остаётся чётким. 100% — непрозрачный.')}</span>
          </label>
          <label className="field">
            <span>{t('Размер шрифта: {n}%', { n: Math.round(o.fontScale * 100) })}</span>
            <input
              type="range"
              min={0.8}
              max={1.8}
              step={0.05}
              value={o.fontScale}
              onChange={(e) => void ctx.patch({ overlay: { fontScale: Number(e.target.value) } })}
            />
          </label>
          <label className="field">
            <span>{t('Ширина окна: {n} px', { n: o.size.width })}</span>
            <input
              type="range"
              min={360}
              max={1400}
              step={10}
              value={o.size.width}
              onChange={(e) => void ctx.patch({ overlay: { size: { width: Number(e.target.value), height: o.size.height } } })}
            />
          </label>
          <label className="field">
            <span>{t('Высота окна: {n} px', { n: o.size.height })}</span>
            <input
              type="range"
              min={160}
              max={1000}
              step={10}
              value={o.size.height}
              onChange={(e) => void ctx.patch({ overlay: { size: { width: o.size.width, height: Number(e.target.value) } } })}
            />
            <span className="small faint">
              {t('В компактном режиме окно растёт под ответ до этой высоты, в развёрнутом — занимает её целиком. Можно и просто потянуть за край окна.')}
            </span>
          </label>
          <label className="field">
            <span>{t('Тема')}</span>
            <select className="input" value={o.theme} onChange={(e) => void ctx.patch({ overlay: { theme: e.target.value as 'dark' | 'light' } })}>
              <option value="dark">{t('Тёмная')}</option>
              <option value="light">{t('Светлая')}</option>
            </select>
          </label>
          <label className="field">
            <span>{t('Язык интерфейса')}</span>
            <select className="input" value={ctx.settings.uiLang} onChange={(e) => void ctx.patch({ uiLang: e.target.value as 'ru' })}>
              <option value="ru">Русский</option>
              <option value="uk">Українська</option>
              <option value="en">English</option>
            </select>
          </label>
        </div>
        <Toggle on={o.pinned} onChange={(v) => void ctx.patch({ overlay: { pinned: v } })} label={t('Поверх всех окон')} />
        <Toggle
          on={ctx.settings.autoAnswer}
          onChange={(v) => void ctx.patch({ autoAnswer: v })}
          label={t('Отвечать автоматически на распознанный вопрос')}
          hint={t(
            'Выключено — ответ по кнопке/горячей клавише: дешевле и предсказуемее. Сомнительные реплики всегда показываются как «Возможный вопрос» без генерации.'
          )}
        />
        <AnswerInstructions ctx={ctx} />
        <div className="small muted">
          {t('Окно перетаскивается за верхнюю полосу и меняет размер за края. Положение и монитор запоминаются. Окно никогда не забирает фокус клавиатуры.')}
        </div>
      </Section>

      <Section title={t('Защита от демонстрации экрана')}>
        <Toggle
          on={o.protect}
          onChange={(v) => void ctx.patch({ overlay: { protect: v } })}
          label={t('Скрывать окно подсказок из захвата экрана')}
          hint={t('Статус: {s}', { s: snap.status.protection.label })}
        />
        <div className="banner small">
          {isMac ? t('Это системный флаг macOS (NSWindowSharingNone).') : t('Это системный флаг Windows (SetWindowDisplayAffinity, WDA_EXCLUDEFROMCAPTURE).')}{' '}
          <b>{t('Он не гарантирует невидимость:')}</b>{' '}
          {t('разные программы захватывают экран по-разному, и мы не обходим средства контроля. Режим тренировки работает полноценно без него.')}
        </div>
        <div className="col small">
          <b>{t('Как проверить у себя (2 минуты):')}</b>
          <ol style={{ margin: 0, paddingLeft: 18 }}>
            <li>{t('Откройте подсказки (оверлей) поверх окна.')}</li>
            <li>{t('Начните демонстрацию экрана в Zoom/Meet/Teams или OBS.')}</li>
            <li>{t('Посмотрите на результат со второго устройства/второго аккаунта или в окне предпросмотра OBS.')}</li>
            <li>{t('Оверлей не виден — защита работает для этого способа захвата. Виден — не полагайтесь на неё.')}</li>
          </ol>
          <div className="faint">
            {t(
              'Проверено автоматически: захват экрана Chromium (Electron desktopCapturer) — окно исключается. Не проверено: Zoom, Teams, Meet, OBS Game/Window Capture, RDP — проверьте сами по шагам выше.'
            )}
          </div>
        </div>
        <Toggle
          on={ctx.settings.window.protectFromCapture}
          onChange={(v) => void ctx.patch({ window: { protectFromCapture: v } })}
          label={t('Скрывать из захвата и главное окно, и выбор области')}
          hint={t(
            'Тот же системный флаг. Если на звонке попросят показать экран, окна Copilot не попадут в поток — но вы их видите. Не гарантия: зависит от программы захвата.'
          )}
        />
      </Section>

      <Section title={t('Окно и трей')}>
        <Toggle
          on={ctx.settings.window.minimizeToTray}
          onChange={(v) => void ctx.patch({ window: { minimizeToTray: v } })}
          label={t('Сворачивать в трей при закрытии и сворачивании')}
          hint={t('Окно прячется в значок рядом с часами, приложение и сессия продолжают работать. Полный выход — через меню значка в трее.')}
        />
        {isMac && (
          <Toggle
            on={ctx.settings.window.hideFromDock}
            onChange={(v) => void ctx.patch({ window: { hideFromDock: v } })}
            label={t('Скрывать из Dock и ⌘Tab')}
            hint={t('Copilot не виден среди запущенных программ — только значок в строке меню справа вверху. Через него открывается окно и делается выход.')}
          />
        )}
        <Toggle
          on={ctx.settings.window.panicQuits}
          onChange={(v) => void ctx.patch({ window: { panicQuits: v } })}
          label={t('Аварийная остановка полностью закрывает приложение')}
          hint={t(
            'По умолчанию аварийная остановка только глушит захват и прячет подсказки, а приложение остаётся в трее. С этой опцией — приложение полностью завершается (процесса не остаётся).'
          )}
        />
      </Section>
    </div>
  )
}

const SHORTCUT_LABEL: Record<ShortcutAction, string> = {
  toggleOverlay: 'Показать / скрыть подсказки',
  toggleListen: 'Пауза / продолжить (или начать сессию)',
  answerNow: 'Ответить сейчас',
  snapRegion: 'Снимок области экрана',
  scrollUp: 'Прокрутить подсказки вверх',
  scrollDown: 'Прокрутить подсказки вниз',
  expand: 'Развернуть / подробный ответ',
  askTyped: 'Написать вопрос вручную',
  panic: 'Аварийная остановка всего'
}

function ShortcutsTab({ ctx }: { ctx: Ctx }) {
  const [rec, setRec] = useState<ShortcutAction | null>(null)
  const [diag] = useAsync(() => api.diagnostics(), [ctx.settings.shortcuts])
  const conflicts = diag?.checks.find((c) => c.id === 'shortcuts')
  return (
    <Section title={t('Глобальные горячие клавиши')}>
      <div className="small muted">
        {t('Работают из любой программы (IDE, Zoom, OBS) и не перехватывают остальной ввод. Нажмите «Изменить», затем сочетание с {mods}.', {
          mods: isMac ? '⌘/⌥/⌃/⇧' : 'Ctrl/Alt/Shift'
        })}
      </div>
      {conflicts && <div className={`banner small ${conflicts.ok ? 'ok' : 'warn'}`}>{conflicts.detail}</div>}
      <div className="col" style={{ gap: 6 }}>
        {(Object.keys(SHORTCUT_LABEL) as ShortcutAction[]).map((a) => (
          <div key={a} className="row">
            <span className="grow">{t(SHORTCUT_LABEL[a])}</span>
            {rec === a ? (
              <input
                className="input"
                style={{ width: 220 }}
                autoFocus
                readOnly
                placeholder={t('Нажмите сочетание…')}
                onBlur={() => setRec(null)}
                onKeyDown={(e) => {
                  e.preventDefault()
                  if (e.key === 'Escape') return setRec(null)
                  const acc = toAccelerator(e.nativeEvent)
                  if (acc) {
                    void ctx.patch({ shortcuts: { [a]: acc } })
                    setRec(null)
                  }
                }}
              />
            ) : (
              <kbd style={{ minWidth: 160, textAlign: 'center' }}>{pretty(ctx.settings.shortcuts[a])}</kbd>
            )}
            <button className="btn sm" onClick={() => setRec(a)}>
              {t('Изменить')}
            </button>
          </div>
        ))}
      </div>
    </Section>
  )
}

function PrivacyTab({ ctx }: { ctx: Ctx }) {
  const c = ctx.settings.consent
  const set = (k: keyof typeof c, v: boolean) => void ctx.patch({ consent: { [k]: v, acceptedAt: Date.now() } })
  const [msg, setMsg] = useState<string | null>(null)
  return (
    <div className="col" style={{ gap: 16 }}>
      <Section title={t('Разрешения')}>
        <Toggle on={c.mic} onChange={(v) => set('mic', v)} label={t('Захват микрофона')} />
        <Toggle on={c.system} onChange={(v) => set('system', v)} label={t('Захват системного звука (голос собеседника)')} />
        <Toggle
          on={c.screen}
          onChange={(v) => set('screen', v)}
          label={t('Снимки экрана по моей команде')}
          hint={t('Никогда не делаются автоматически и не отправляются без подтверждения.')}
        />
        <Toggle
          on={c.cloud}
          onChange={(v) => set('cloud', v)}
          label={t('Отправка текста облачным провайдерам')}
          hint={t('Нужно для OpenAI / Anthropic / Gemini / AnyModel. Для Ollama не требуется.')}
        />
        <Toggle on={c.history} onChange={(v) => set('history', v)} label={t('Сохранять историю сессий на этом компьютере')} />
        <div className="small muted">{t('Телеметрии нет: приложение ничего не отправляет своим разработчикам.')}</div>
      </Section>
      <Section title={t('Офлайн-режим')}>
        <Toggle
          on={ctx.settings.offline}
          onChange={(v) => void ctx.patch({ offline: v })}
          label={t('Работать без интернета')}
          hint={t('Блокирует все внешние адреса на уровне приложения. Работают только локальные модели (Ollama, LM Studio) и локальное распознавание.')}
        />
      </Section>
      <Section title={t('Данные')}>
        <div className="small">
          {t('История, транскрипты и индексы документов лежат в SQLite в')}{' '}
          <span className="mono">{isMac ? '~/Library/Application Support/copilot' : '%APPDATA%\\copilot'}</span>.{' '}
          {t('Ключи — в отдельном файле, зашифрованном системным хранилищем ({store}). Сырое аудио не сохраняется.', {
            store: isMac ? t('Связка ключей macOS') : 'Windows DPAPI'
          })}
        </div>
        <div className="small muted">
          {t(
            'Важно: то, что приложение не шлёт данные своим серверам, не значит, что данные не уходят провайдеру модели. Облачный провайдер получает текст вопроса и выбранный контекст по своей политике данных.'
          )}
        </div>
        <div className="row">
          <button
            className="btn danger"
            onClick={async () => {
              await api.history.removeAll()
              setMsg(t('История и журнал диагностики удалены.'))
            }}
          >
            {t('Удалить всю историю')}
          </button>
          {msg && <span className="small">{msg}</span>}
        </div>
        <div className="small muted">
          {t('Ответственность за допустимость записи и AI-подсказок в конкретном интервью/встрече — на пользователе. Сообщайте участникам о записи.')}
        </div>
      </Section>
    </div>
  )
}

function UsageTab({ ctx, snap }: { ctx: Ctx; snap: AppSnapshot }) {
  const b = ctx.settings.budget
  const roles = Object.values(ctx.settings.roles).filter(Boolean) as { providerId: string; model: string }[]
  const uniq = [...new Map(roles.map((r) => [`${r.providerId}/${r.model}`, r])).values()]
  const num = (v: string) => (v.trim() === '' ? null : Number(v))
  return (
    <div className="col" style={{ gap: 16 }}>
      <Section title={t('Лимиты')}>
        <div className="grid2">
          <label className="field">
            <span>{t('Максимум $ за сессию (пусто — без лимита)')}</span>
            <input
              className="input"
              type="number"
              min={0}
              step={0.1}
              value={b.perSessionUsd ?? ''}
              onChange={(e) => void ctx.patch({ budget: { perSessionUsd: num(e.target.value) } })}
            />
          </label>
          <label className="field">
            <span>{t('Максимум $ в день')}</span>
            <input
              className="input"
              type="number"
              min={0}
              step={0.5}
              value={b.perDayUsd ?? ''}
              onChange={(e) => void ctx.patch({ budget: { perDayUsd: num(e.target.value) } })}
            />
          </label>
          <label className="field">
            <span>{t('Запросов в минуту')}</span>
            <input
              className="input"
              type="number"
              min={1}
              value={b.requestsPerMinute}
              onChange={(e) => void ctx.patch({ budget: { requestsPerMinute: Number(e.target.value) } })}
            />
          </label>
          <label className="field">
            <span>{t('Одновременных запросов')}</span>
            <input
              className="input"
              type="number"
              min={1}
              max={6}
              value={b.maxConcurrent}
              onChange={(e) => void ctx.patch({ budget: { maxConcurrent: Number(e.target.value) } })}
            />
          </label>
        </div>
        <div className="small muted">
          {t(
            'При достижении лимита платные запросы останавливаются до вашего подтверждения. Провайдер сам не переключается. Локальные модели лимитом $ не ограничиваются.'
          )}
        </div>
      </Section>
      <Section title={t('Цены моделей')}>
        <div className="small muted">
          {t('Цены меняются — впишите актуальные с сайта провайдера ($ за 1 млн токенов). Без цены расход показывается как «Цена неизвестна», а не $0.')}
        </div>
        {uniq.map((r) => {
          const key = `${r.providerId}/${r.model}`
          const p = ctx.settings.pricing[key]
          return (
            <div key={key} className="row">
              <span className="grow mono small">{r.model}</span>
              <input
                className="input"
                style={{ width: 120 }}
                type="number"
                min={0}
                step={0.01}
                placeholder={t('вход')}
                value={p?.inputPerMTok ?? ''}
                onChange={(e) => void ctx.patch({ pricing: { [key]: { inputPerMTok: Number(e.target.value), outputPerMTok: p?.outputPerMTok ?? 0 } } })}
              />
              <input
                className="input"
                style={{ width: 120 }}
                type="number"
                min={0}
                step={0.01}
                placeholder={t('выход')}
                value={p?.outputPerMTok ?? ''}
                onChange={(e) => void ctx.patch({ pricing: { [key]: { inputPerMTok: p?.inputPerMTok ?? 0, outputPerMTok: Number(e.target.value) } } })}
              />
            </div>
          )
        })}
        {!uniq.length && <div className="muted small">{t('Сначала выберите модели на вкладке «Провайдеры».')}</div>}
      </Section>
      <Section title={t('Текущая сессия')}>
        <div className="small">
          {t('Запросов: {n} · расход: {usd}', { n: snap.cost.requests, usd: snap.cost.usd == null ? '—' : `$${snap.cost.usd.toFixed(4)}` })}
          {snap.cost.unknownPriced > 0 && ' · ' + t('без цены: {n}', { n: snap.cost.unknownPriced })}
        </div>
      </Section>
    </div>
  )
}

function DiagnosticsTab() {
  const [rep, setRep] = useState<DiagReport | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [log, reloadLog] = useAsync(() => api.diagLog(), [])
  const run = async () => {
    setBusy(true)
    setErr(null)
    try {
      setRep(await api.diagnostics())
      reloadLog()
    } catch (e) {
      setErr((e as Error).message)
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="col" style={{ gap: 16 }}>
      <Section
        title={t('Проверка системы')}
        aside={
          <button className="btn primary" onClick={() => void run()} disabled={busy}>
            {busy ? t('Проверяю…') : t('Запустить проверку')}
          </button>
        }
      >
        <ErrorText text={err} />
        {rep?.checks.map((c) => (
          <div key={c.id} className="row" style={{ alignItems: 'flex-start' }}>
            <span className={`dot ${c.ok === true ? 'ok' : c.ok === false ? 'error' : 'warn'}`} style={{ marginTop: 6 }} />
            <div className="grow">
              <b>{c.label}</b>
              <div className="small muted">{c.detail}</div>
            </div>
            {c.id === 'ocr' && !c.ok && (
              <button
                className="btn sm"
                onClick={async () => {
                  try {
                    await api.installOcr()
                    await run()
                  } catch (e) {
                    setErr((e as Error).message)
                  }
                }}
              >
                {t('Установить OCR (≈10 МБ)')}
              </button>
            )}
          </div>
        ))}
        {!rep && (
          <div className="muted small">{t('Проверит ключи, распознавание, соединение с моделями, горячие клавиши, защиту окна, офлайн-режим и базу.')}</div>
        )}
      </Section>
      <Section title={t('Журнал (без ключей и текстов разговоров)')}>
        <div className="col mono small scroll" style={{ maxHeight: 280, gap: 2 }}>
          {log?.map((l, i) => (
            <div key={i}>
              <span className="faint">{fmtDate(l.at)}</span> {l.kind} {l.data.slice(0, 200)}
            </div>
          ))}
          {log && !log.length && <div className="muted">{t('Пусто')}</div>}
        </div>
      </Section>
    </div>
  )
}

/** Free-form instructions for the answer prompt; saved on blur so typing does not write settings on every key. */
function AnswerInstructions({ ctx }: { ctx: Ctx }) {
  const [text, setText] = useState(ctx.settings.answerInstructions)
  const saved = text === ctx.settings.answerInstructions
  return (
    <label className="field">
      <span>{t('Как отвечать (ваши инструкции для ИИ)')}</span>
      <textarea
        className="input"
        rows={4}
        maxLength={2000}
        value={text}
        placeholder={t('Например: отвечай коротко, от первого лица, как опытный QA; приводи примеры из fintech; без канцелярита.')}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => !saved && void ctx.patch({ answerInstructions: text })}
      />
      <span className="small faint">
        {saved
          ? t('Добавляется к каждому ответу. Правила безопасности (не выдумывать факты, не раскрывать ключи) важнее.')
          : t('Сохранится, когда уйдёте из поля.')}
      </span>
    </label>
  )
}
