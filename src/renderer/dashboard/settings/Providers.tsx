import { useEffect, useState } from 'react'
import type { ModelInfo, ModelRole, ProviderConfig, ProviderPreset } from '@shared/types'
import { api, isMac, type PresetInfo, type ProviderTestReport } from '../../lib/api'
import { useAsync } from '../../lib/hooks'
import type { Ctx } from '../App'
import { ErrorText, Toggle } from '../ui'

const ROLE_LABEL: Record<ModelRole, string> = {
  quick_answer: 'Быстрый ответ (Say it, тезисы)',
  deep_answer: 'Подробный ответ',
  vision: 'Снимки экрана (vision)',
  classification: 'Классификация',
  post_session_summary: 'Итог встречи'
}

export function ProviderForm({
  presets,
  initial,
  onSaved,
  onCancel
}: {
  presets: Record<ProviderPreset, PresetInfo>
  initial?: ProviderConfig
  onSaved: (p: ProviderConfig) => void
  onCancel?: () => void
}) {
  const [preset, setPreset] = useState<ProviderPreset>(initial?.preset ?? 'ollama')
  const [label, setLabel] = useState(initial?.label ?? presets.ollama.label)
  const [baseUrl, setBaseUrl] = useState(initial?.baseUrl ?? presets.ollama.baseUrl)
  const [key, setKey] = useState('')
  const [allowFallback, setAllowFallback] = useState(initial?.allowFallback ?? false)
  const [timeoutMs, setTimeoutMs] = useState(initial?.timeoutMs ?? 12000)
  const [err, setErr] = useState<string | null>(null)
  const [warn, setWarn] = useState<string | null>(null)
  const info = presets[preset]

  const pick = (p: ProviderPreset) => {
    setPreset(p)
    setLabel(presets[p].label)
    setBaseUrl(presets[p].baseUrl)
    setTimeoutMs(p === 'ollama' || p === 'lmstudio' || p === 'custom' ? 30000 : 12000)
  }

  const save = async () => {
    setErr(null)
    try {
      const r = await api.providers.upsert(
        { id: initial?.id ?? '', label, preset, protocol: 'openai', baseUrl: baseUrl.trim(), hasKey: false, allowFallback, timeoutMs },
        key || null
      )
      setWarn(r.warning)
      setKey('')
      onSaved(r.provider)
    } catch (e) {
      setErr((e as Error).message)
    }
  }

  return (
    <div className="col">
      <div className="preset-grid">
        {(Object.keys(presets) as ProviderPreset[]).map((p) => (
          <button key={p} className={`preset ${preset === p ? 'on' : ''}`} onClick={() => pick(p)} disabled={!!initial}>
            <b>{presets[p].label}</b>
            <span className="small muted">{presets[p].needsKey ? 'нужен ключ' : 'без ключа'}</span>
          </button>
        ))}
      </div>
      <div className="small muted">{info.note}</div>
      <div className="grid2">
        <label className="field">
          <span>Название</span>
          <input className="input" value={label} onChange={(e) => setLabel(e.target.value)} />
        </label>
        <label className="field">
          <span>Адрес API</span>
          <input className="input mono" value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} />
        </label>
        <label className="field">
          <span>
            API-ключ {initial?.hasKey ? '(сохранён — введите новый, чтобы заменить)' : info.needsKey ? '' : '(не обязателен)'}{' '}
            {info.keyUrl && (
              <a href="#" onClick={() => void api.open(info.keyUrl!)}>
                где взять
              </a>
            )}
          </span>
          <input
            className="input mono"
            type="password"
            autoComplete="off"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder={initial?.hasKey ? '••••••••' : ''}
          />
        </label>
        <label className="field">
          <span>Ждать первый токен, мс</span>
          <input className="input" type="number" min={2000} step={1000} value={timeoutMs} onChange={(e) => setTimeoutMs(Number(e.target.value))} />
        </label>
      </div>
      <Toggle
        on={allowFallback}
        onChange={setAllowFallback}
        label="Разрешить как запасной"
        hint="Если основной провайдер недоступен (429/5xx/таймаут), запрос можно отправить сюда. Без этой галочки данные сюда не попадут."
      />
      <div className="small muted">Ключ шифруется системным хранилищем ({isMac ? 'Связка ключей' : 'DPAPI'}) и не попадает в настройки, логи и экспорт.</div>
      <ErrorText text={err} />
      {warn && <div className="banner warn small">{warn}</div>}
      <div className="row">
        <button className="btn primary" onClick={() => void save()} disabled={!baseUrl.trim() || (info.needsKey && !key && !initial?.hasKey)}>
          Сохранить
        </button>
        {onCancel && (
          <button className="btn ghost" onClick={onCancel}>
            Отмена
          </button>
        )}
      </div>
    </div>
  )
}

export function ModelSelect({ providerId, value, onChange }: { providerId: string; value: string; onChange: (m: string) => void }) {
  const [models, setModels] = useState<ModelInfo[] | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [manual, setManual] = useState(false)
  const load = async (refresh: boolean) => {
    setErr(null)
    try {
      setModels(await api.providers.models(providerId, refresh))
    } catch (e) {
      setErr((e as Error).message)
      setModels([])
    }
  }
  useEffect(() => {
    void load(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [providerId])

  const known = models?.some((m) => m.id === value)
  return (
    <div className="col" style={{ gap: 4 }}>
      <div className="row">
        {manual || (models && !models.length) ? (
          <input className="input mono grow" placeholder="ID модели" value={value} onChange={(e) => onChange(e.target.value)} />
        ) : (
          <select className="input grow" value={known ? value : ''} onChange={(e) => onChange(e.target.value)}>
            <option value="">{models ? '— выберите модель —' : 'загрузка…'}</option>
            {models?.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label && m.label !== m.id ? `${m.label} (${m.id})` : m.id}
                {m.vision === true ? ' · vision' : ''}
              </option>
            ))}
          </select>
        )}
        <button className="btn sm" title="Обновить список из API" onClick={() => void load(true)}>
          ↻
        </button>
        <button className="btn sm ghost" onClick={() => setManual((v) => !v)}>
          {manual ? 'список' : 'вручную'}
        </button>
      </div>
      {err && (
        <div className="small" style={{ color: 'var(--err)' }}>
          {err}
        </div>
      )}
    </div>
  )
}

export function TestResult({ r }: { r: ProviderTestReport | null }) {
  if (!r) return null
  return (
    <div className="col small" style={{ gap: 3 }}>
      <div>
        <span className={`dot ${r.models.ok ? 'ok' : 'error'}`} style={{ display: 'inline-block', marginRight: 6 }} />
        Соединение:{' '}
        {r.models.ok
          ? `ок, ${r.models.models} моделей, ${r.models.latencyMs} мс`
          : `${r.models.error.message}${r.models.error.detail ? ` — ${r.models.error.detail}` : ''}`}
      </div>
      {r.text && (
        <div>
          <span className={`dot ${r.text.ok ? 'ok' : 'error'}`} style={{ display: 'inline-block', marginRight: 6 }} />
          Текст: {r.text.ok ? `ок, первый токен ${r.text.ms} мс («${r.text.sample}»)` : r.text.error}
        </div>
      )}
      {r.vision && (
        <div>
          <span className={`dot ${r.vision.ok ? 'ok' : 'warn'}`} style={{ display: 'inline-block', marginRight: 6 }} />
          Изображение: {r.vision.ok ? 'ок, модель видит картинки' : `нет — ${r.vision.error}. Для снимков будет локальный OCR.`}
        </div>
      )}
    </div>
  )
}

export function RoleRow({ ctx, role, providers }: { ctx: Ctx; role: ModelRole; providers: ProviderConfig[] }) {
  const cur = ctx.settings.roles[role]
  const [test, setTest] = useState<ProviderTestReport | null>(null)
  const [busy, setBusy] = useState(false)
  const set = (providerId: string, model: string) => void ctx.patch({ roles: { [role]: providerId ? { providerId, model } : null } })
  return (
    <div className="role-row col" style={{ gap: 6 }}>
      <div className="row">
        <b className="grow">{ROLE_LABEL[role]}</b>
        {cur?.model && (
          <button
            className="btn sm"
            disabled={busy}
            onClick={async () => {
              setBusy(true)
              setTest(null)
              try {
                setTest(await api.providers.test(cur.providerId, cur.model))
              } finally {
                setBusy(false)
              }
            }}
          >
            {busy ? 'Проверяю…' : 'Проверить соединение'}
          </button>
        )}
      </div>
      <div className="row">
        <select className="input" style={{ width: 240 }} value={cur?.providerId ?? ''} onChange={(e) => set(e.target.value, '')}>
          <option value="">— не использовать —</option>
          {providers.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </select>
        {cur?.providerId && (
          <div className="grow">
            <ModelSelect providerId={cur.providerId} value={cur.model} onChange={(m) => set(cur.providerId, m)} />
          </div>
        )}
      </div>
      <TestResult r={test} />
    </div>
  )
}

export function ProvidersTab({ ctx }: { ctx: Ctx }) {
  const [providers, reload] = useAsync(() => api.providers.list(), [])
  const [editing, setEditing] = useState<ProviderConfig | 'new' | null>(null)

  return (
    <div className="col" style={{ gap: 16 }}>
      <section className="card col">
        <div className="row between">
          <h2>Подключённые провайдеры</h2>
          <button className="btn" onClick={() => setEditing('new')}>
            + Добавить
          </button>
        </div>
        {editing && (
          <div className="card" style={{ background: 'var(--surface-2)' }}>
            <ProviderForm
              presets={ctx.init.presets}
              initial={editing === 'new' ? undefined : editing}
              onSaved={() => {
                setEditing(null)
                reload()
              }}
              onCancel={() => setEditing(null)}
            />
          </div>
        )}
        {providers?.map((p) => (
          <div key={p.id} className="row prov-row">
            <span className={`chip ${/127\.0\.0\.1|localhost/.test(p.baseUrl) ? '' : 'accent'}`}>
              {/127\.0\.0\.1|localhost/.test(p.baseUrl) ? 'локально' : 'облако'}
            </span>
            <b>{p.label}</b>
            <span className="faint mono small grow">{p.baseUrl}</span>
            {p.hasKey && <span className="chip">ключ зашифрован</span>}
            {p.allowFallback && <span className="chip">запасной</span>}
            <button className="btn sm" onClick={() => setEditing(p)}>
              Изменить
            </button>
            <button
              className="btn sm danger"
              onClick={async () => {
                await api.providers.remove(p.id)
                reload()
              }}
            >
              Удалить
            </button>
          </div>
        ))}
        {providers && !providers.length && !editing && <div className="muted small">Пока нет. Для работы без интернета выберите Ollama.</div>}
      </section>

      {!!providers?.length && (
        <section className="card col" style={{ gap: 16 }}>
          <h2>Какая модель за что отвечает</h2>
          <div className="small muted">Список моделей берётся из API провайдера. Новую модель можно вписать вручную.</div>
          {(['quick_answer', 'deep_answer', 'vision'] as ModelRole[]).map((r) => (
            <RoleRow key={r} ctx={ctx} role={r} providers={providers} />
          ))}
        </section>
      )}
    </div>
  )
}
