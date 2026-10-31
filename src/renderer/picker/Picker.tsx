import { useEffect, useRef, useState } from 'react'
import type { ScreenTask } from '@shared/types'
import { api, km, type PickerInit } from '../lib/api'
import { setLang, t } from '../lib/i18n'

interface Rect {
  x: number
  y: number
  w: number
  h: number
}

function norm(a: { x: number; y: number }, b: { x: number; y: number }): Rect {
  return { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), w: Math.abs(a.x - b.x), h: Math.abs(a.y - b.y) }
}

const LANGS = ['Python', 'TypeScript', 'JavaScript', 'Java', 'Go', 'C#', 'C++', 'Kotlin', 'SQL']

export function Picker() {
  const [init, setInit] = useState<PickerInit | null>(null)
  const [sel, setSel] = useState<Rect | null>(null)
  const [drag, setDrag] = useState<{ x: number; y: number } | null>(null)
  const [cur, setCur] = useState<Rect | null>(null)
  const [blurMode, setBlurMode] = useState(false)
  const [blurs, setBlurs] = useState<Rect[]>([])
  const [withCode, setWithCode] = useState(false)
  const [codeLang, setCodeLang] = useState('Python')
  const [busy, setBusy] = useState(false)
  const [instruction, setInstruction] = useState('')
  const img = useRef<HTMLImageElement>(null)

  useEffect(() => km.onPickerInit((m) => setInit(m)), [])
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') void api.screen.cancel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  if (!init) return <div className="pk-loading">…</div>
  setLang(init.uiLang ?? 'ru')

  const down = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('.pk-bar')) return
    if (sel && !blurMode) {
      setSel(null)
      setBlurs([])
    }
    setDrag({ x: e.clientX, y: e.clientY })
    setCur({ x: e.clientX, y: e.clientY, w: 0, h: 0 })
  }
  const move = (e: React.MouseEvent) => {
    if (drag) setCur(norm(drag, { x: e.clientX, y: e.clientY }))
  }
  const up = () => {
    if (!drag || !cur) return
    setDrag(null)
    if (cur.w > 8 && cur.h > 8) {
      if (blurMode && sel) setBlurs((b) => [...b, cur])
      else setSel(cur)
    }
    setCur(null)
  }

  const submit = async (task: ScreenTask) => {
    if (!sel || !img.current) return
    if (task === 'custom' && !instruction.trim()) return
    setBusy(true)
    const el = img.current
    const k = el.naturalWidth / el.clientWidth
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(sel.w * k)
    canvas.height = Math.round(sel.h * k)
    const ctx = canvas.getContext('2d')!
    ctx.drawImage(el, sel.x * k, sel.y * k, canvas.width, canvas.height, 0, 0, canvas.width, canvas.height)
    for (const b of blurs) {
      const bx = Math.round((b.x - sel.x) * k)
      const by = Math.round((b.y - sel.y) * k)
      const bw = Math.round(b.w * k)
      const bh = Math.round(b.h * k)
      ctx.fillStyle = '#7a7a7a'
      ctx.fillRect(bx, by, bw, bh)
    }
    const png = canvas.toDataURL('image/png').split(',')[1]
    await api.screen.submit(png, task, withCode, codeLang, task === 'custom' ? instruction.trim() : '')
  }

  return (
    <div className="pk" onMouseDown={down} onMouseMove={move} onMouseUp={up} style={{ cursor: blurMode ? 'cell' : 'crosshair' }}>
      <img ref={img} src={init.dataUrl} className="pk-img" draggable={false} alt="" />
      <div className="pk-shade" style={sel ? { clipPath: holePath(sel) } : undefined} />
      {sel && <div className="pk-sel" style={rectStyle(sel)} />}
      {blurs.map((b, i) => (
        <div key={i} className="pk-blur" style={rectStyle(b)} />
      ))}
      {cur && <div className={blurMode && sel ? 'pk-blur' : 'pk-sel'} style={rectStyle(cur)} />}
      {!sel && <div className="pk-help">{t('Выделите область мышью. Esc — отмена.')}</div>}
      {sel && !drag && (
        <div className="pk-bar" style={barPos(sel)} onMouseDown={(e) => e.stopPropagation()}>
          <div className="row wrap">
            <button
              className="btn primary sm"
              disabled={busy}
              title={t('Найдёт вопрос в последних 2 минутах разговора и ответит на него вместе со снимком')}
              onClick={() => void submit('context')}
            >
              {t('Вопрос из разговора')}
            </button>
            <button className="btn primary sm" disabled={busy} title={t('Только снимок: без разговора и без резюме')} onClick={() => void submit('solve')}>
              {t('Решить самостоятельно')}
            </button>
          </div>
          <form
            className="row"
            style={{ marginTop: 8 }}
            onSubmit={(e) => {
              e.preventDefault()
              void submit('custom')
            }}
          >
            <input
              className="input grow"
              style={{ height: 30 }}
              autoFocus
              placeholder={t('Своё задание: что сделать со снимком…')}
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
            />
            <button className="btn primary sm" type="submit" disabled={busy || !instruction.trim()}>
              {t('Отправить')}
            </button>
          </form>
          <div className="row wrap" style={{ marginTop: 8 }}>
            <button className="btn sm" disabled={busy} onClick={() => void submit('explain')}>
              {t('Объясни условие')}
            </button>
            <button className="btn sm" disabled={busy} onClick={() => void submit('approach')}>
              {t('Предложи подход')}
            </button>
            <button className="btn sm" disabled={busy} onClick={() => void submit('review')}>
              {t('Разбери код')}
            </button>
          </div>
          <div className="row wrap" style={{ marginTop: 8 }}>
            <label className="row small" style={{ gap: 6 }}>
              <input type="checkbox" checked={withCode} onChange={(e) => setWithCode(e.target.checked)} /> {t('с кодом')}
            </label>
            {withCode && (
              <select className="input" style={{ width: 130, height: 28 }} value={codeLang} onChange={(e) => setCodeLang(e.target.value)}>
                {LANGS.map((l) => (
                  <option key={l}>{l}</option>
                ))}
              </select>
            )}
            <button className={`btn sm ${blurMode ? 'primary' : ''}`} onClick={() => setBlurMode((v) => !v)}>
              {t('Размыть область')}
            </button>
            <button className="btn sm ghost" onClick={() => void api.screen.cancel()}>
              {t('Отмена')}
            </button>
          </div>
          <div className="faint small" style={{ marginTop: 6 }}>
            {init.hasVision
              ? t('Отправится только выделенная область, после нажатия кнопки.')
              : init.ocr
                ? t('Модель без vision: текст распознается локально (OCR) и уйдёт текстом.')
                : t('Нет vision-модели и OCR — установите OCR в «Диагностике».')}
            {blurMode && ` ${t('Обведите личные данные — они будут закрашены.')}`}
          </div>
        </div>
      )}
    </div>
  )
}

function rectStyle(r: Rect): React.CSSProperties {
  return { left: r.x, top: r.y, width: r.w, height: r.h }
}

function holePath(r: Rect): string {
  const W = '100vw'
  const H = '100vh'
  return `polygon(0 0, ${W} 0, ${W} ${H}, 0 ${H}, 0 0, ${r.x}px ${r.y}px, ${r.x}px ${r.y + r.h}px, ${r.x + r.w}px ${r.y + r.h}px, ${r.x + r.w}px ${r.y}px, ${r.x}px ${r.y}px)`
}

function barPos(r: Rect): React.CSSProperties {
  const below = r.y + r.h + 230 < window.innerHeight
  return { left: Math.min(Math.max(8, r.x), window.innerWidth - 470), top: below ? r.y + r.h + 10 : Math.max(8, r.y - 220) }
}
