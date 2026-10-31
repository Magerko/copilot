import { useEffect, useState } from 'react'
import type { AsrStatus, Lang, Source } from '@shared/types'
import { api, isMac } from '../../lib/api'
import { probeLevel } from '../../lib/audio'
import type { Ctx } from '../App'
import { ErrorText, Meter, Toggle } from '../ui'

const ASR_OPTIONS = [
  { backend: 'cpu' as const, model: 'base', title: 'Быстрый (процессор)', size: '≈160 МБ', note: '≈1 с на фразу на CPU. Подходит всем.' },
  { backend: 'cpu' as const, model: 'small', title: 'Точнее (процессор)', size: '≈500 МБ', note: '≈2 с на фразу — медленнее, но лучше на акцентах.' },
  {
    backend: 'cuda' as const,
    model: 'turbo',
    title: 'Максимум (видеокарта NVIDIA)',
    size: '≈1.3 ГБ',
    note: '≈0.1 с на фразу и лучшая точность. Первый запуск прогревается до 30 с.'
  }
]

// A fixed language is ~1.5× faster on CPU (spike S2, audit 2026-10-28) and never turns speech into a translation.
export const ASR_LANG_OPTIONS = (
  <>
    <option value="ru">Русский</option>
    <option value="uk">Українська</option>
    <option value="en">English</option>
    <option value="auto">Смешанный — автоопределение (медленнее)</option>
  </>
)

export function AsrInstaller({ ctx, asr, compact }: { ctx: Ctx; asr: AsrStatus | null; compact?: boolean }) {
  const [nvidia, setNvidia] = useState<boolean | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    void api.hasNvidia().then(setNvidia)
  }, [])
  const cur = ctx.settings.asr
  const dl = asr?.download

  const install = async (backend: 'cpu' | 'cuda', model: string) => {
    setErr(null)
    setBusy(true)
    try {
      await api.asr.install(backend, model)
    } catch (e) {
      setErr((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="col">
      <div className="asr-grid">
        {ASR_OPTIONS.filter((o) => !compact || o.model !== 'small').map((o) => {
          const active = cur.backend === o.backend && cur.model === o.model
          const ready = active && asr?.binary && asr?.modelPresent
          const disabled = busy || (o.backend === 'cuda' && nvidia === false)
          return (
            <div key={o.model} className={`asr-opt ${active ? 'on' : ''}`}>
              <b>{o.title}</b>
              <span className="small muted">{o.note}</span>
              <span className="small faint">
                Загрузка {o.size}
                {o.backend === 'cuda' && nvidia === false ? ' · NVIDIA не найдена' : ''}
              </span>
              <button className={`btn sm ${active ? '' : 'primary'}`} disabled={disabled || !!ready} onClick={() => void install(o.backend, o.model)}>
                {ready ? 'Установлено' : active ? 'Доустановить' : 'Установить и выбрать'}
              </button>
            </div>
          )
        })}
      </div>
      {dl && (
        <div className="col" style={{ gap: 4 }}>
          <div className="small">
            Загрузка: {dl.name} — {Math.round(dl.received / 1048576)} / {dl.total ? Math.round(dl.total / 1048576) : '?'} МБ
          </div>
          <div className="meter">
            <i style={{ width: `${dl.total ? (dl.received / dl.total) * 100 : 5}%`, background: 'var(--info)' }} />
          </div>
          <div className="small faint">Модели проверяются по SHA-256 после загрузки.</div>
        </div>
      )}
      <ErrorText text={err ?? asr?.error ?? null} />
    </div>
  )
}

function Probe({ source, deviceId }: { source: Source; deviceId: string | null }) {
  const [level, setLevel] = useState(0)
  const [verdict, setVerdict] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const run = async () => {
    setBusy(true)
    setVerdict(null)
    try {
      const max = await probeLevel(source, deviceId, 4000, setLevel)
      setVerdict(
        max > 0.02
          ? 'Сигнал есть — всё слышно.'
          : max > 0.004
            ? 'Очень тихо — проверьте громкость.'
            : source === 'user'
              ? 'Тишина. Проверьте выбранный микрофон и его громкость в Windows.'
              : 'Тишина. Включите звук в звонке/видео во время проверки.'
      )
    } catch (e) {
      setVerdict(`Ошибка: ${(e as Error).message}`)
    } finally {
      setLevel(0)
      setBusy(false)
    }
  }
  return (
    <div className="col" style={{ gap: 6 }}>
      <div className="row">
        <button className="btn sm" onClick={() => void run()} disabled={busy}>
          {busy ? 'Слушаю 4 с…' : source === 'user' ? 'Слышит ли меня?' : 'Слышит ли собеседника?'}
        </button>
        <div className="grow">
          <Meter value={level} />
        </div>
      </div>
      {verdict && <div className="small">{verdict}</div>}
    </div>
  )
}

export function DeviceSettings({ ctx }: { ctx: Ctx }) {
  const [mics, setMics] = useState<MediaDeviceInfo[]>([])
  useEffect(() => {
    const load = () =>
      navigator.mediaDevices
        .enumerateDevices()
        .then((d) => setMics(d.filter((x) => x.kind === 'audioinput')))
        .catch(() => setMics([]))
    void navigator.mediaDevices
      .getUserMedia({ audio: true })
      .then((s) => s.getTracks().forEach((t) => t.stop()))
      .catch(() => {})
      .finally(load)
    navigator.mediaDevices.addEventListener('devicechange', load)
    return () => navigator.mediaDevices.removeEventListener('devicechange', load)
  }, [])
  const a = ctx.settings.audio
  return (
    <div className="grid2">
      <div className="col">
        <Toggle on={a.captureMic} onChange={(v) => void ctx.patch({ audio: { captureMic: v } })} label="Мой микрофон" hint="Ваша речь — источник «user»" />
        <select className="input" value={a.micDeviceId ?? ''} onChange={(e) => void ctx.patch({ audio: { micDeviceId: e.target.value || null } })}>
          <option value="">Системный по умолчанию</option>
          {mics
            .filter((m) => m.deviceId && m.deviceId !== 'default' && m.deviceId !== 'communications')
            .map((m) => (
              <option key={m.deviceId} value={m.deviceId}>
                {m.label || 'Микрофон'}
              </option>
            ))}
        </select>
        <Probe source="user" deviceId={a.micDeviceId} />
      </div>
      <div className="col">
        <Toggle
          on={a.captureSystem}
          onChange={(v) => void ctx.patch({ audio: { captureSystem: v } })}
          label="Звук собеседника (системный звук)"
          hint={
            isMac
              ? 'Весь звук, который играет Mac (ScreenCaptureKit). Нужно разрешение «Запись экрана и системного звука» в Системных настройках → Конфиденциальность. macOS 13+.'
              : 'WASAPI loopback: весь звук, который играет Windows. Захват отдельного приложения пока не поддерживается.'
          }
        />
        <div className="small muted">Совет: наушники убирают эхо собеседника в микрофоне.</div>
        <Probe source="remote" deviceId={null} />
      </div>
    </div>
  )
}

export function AudioTab({ ctx, asr }: { ctx: Ctx; asr: AsrStatus | null }) {
  const s = ctx.settings.asr
  const [vocab, setVocab] = useState(s.vocabulary.join(', '))
  return (
    <div className="col" style={{ gap: 16 }}>
      <section className="card col">
        <h2>Устройства</h2>
        <DeviceSettings ctx={ctx} />
        <div className="small muted">Сырое аудио на диск не пишется. Пауза и «Завершить» останавливают захват полностью.</div>
      </section>
      <section className="card col">
        <h2>Распознавание речи (локально, whisper.cpp)</h2>
        <AsrInstaller ctx={ctx} asr={asr} />
        <div className="grid2">
          <label className="field">
            <span>Язык речи</span>
            <select className="input" value={s.language} onChange={(e) => void ctx.patch({ asr: { language: e.target.value as 'auto' | Lang } })}>
              {ASR_LANG_OPTIONS}
            </select>
          </label>
          <label className="field">
            <span>Потоков процессора</span>
            <input
              className="input"
              type="number"
              min={1}
              max={32}
              value={s.threads}
              onChange={(e) => void ctx.patch({ asr: { threads: Number(e.target.value) } })}
            />
          </label>
        </div>
        <label className="field">
          <span>Словарь терминов — помогает правильно писать названия (через запятую)</span>
          <input
            className="input"
            value={vocab}
            onChange={(e) => setVocab(e.target.value)}
            onBlur={() =>
              void ctx.patch({
                asr: {
                  vocabulary: vocab
                    .split(',')
                    .map((x) => x.trim())
                    .filter(Boolean)
                }
              })
            }
          />
        </label>
        {asr?.lastLatencyMs != null && <div className="small muted">Последняя задержка распознавания: {asr.lastLatencyMs} мс</div>}
      </section>
    </div>
  )
}
