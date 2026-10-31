import { readFile, stat } from 'node:fs/promises'
import { extname } from 'node:path'
import { t } from '@shared/i18n'

const MAX_BYTES = 15 * 1024 * 1024

/** I extract text locally only (FR-C01): nothing leaves the machine during import. */
export async function extractText(filePath: string): Promise<string> {
  const st = await stat(filePath)
  if (st.size > MAX_BYTES) throw new Error(t('Файл больше 15 МБ'))
  const ext = extname(filePath).toLowerCase()
  switch (ext) {
    case '.txt':
    case '.md':
    case '.markdown':
      return (await readFile(filePath, 'utf8')).replace(/^﻿/, '')
    case '.docx': {
      const mammoth = await import('mammoth')
      const r = await mammoth.extractRawText({ path: filePath })
      return r.value
    }
    case '.pdf':
      return extractPdf(await readFile(filePath))
    default:
      throw new Error(t('Формат {ext} не поддерживается — используйте PDF, DOCX, TXT или MD', { ext: ext || t('без расширения') }))
  }
}

/**
 * pdfjs runs `new DOMMatrix()` at module load and polyfills it from @napi-rs/canvas, whose native binary exists only
 * for the platform npm installed on (a build made on another OS ships none). Text extraction never renders, so when the
 * real class is missing I fall back to a stub instead of failing with "DOMMatrix is not defined".
 */
export async function ensureDomMatrix(load: () => Promise<{ DOMMatrix?: unknown }> = () => import('@napi-rs/canvas')): Promise<void> {
  const g = globalThis as { DOMMatrix?: unknown }
  if (g.DOMMatrix) return
  try {
    const m = await load()
    if (m.DOMMatrix) {
      g.DOMMatrix = m.DOMMatrix
      return
    }
  } catch {
    // native binary missing for this platform — use the stub below
  }
  g.DOMMatrix = StubDOMMatrix
}

class StubDOMMatrix {
  a = 1
  b = 0
  c = 0
  d = 1
  e = 0
  f = 0
  constructor(init?: number[]) {
    if (Array.isArray(init) && init.length >= 6) [this.a, this.b, this.c, this.d, this.e, this.f] = init
  }
  multiplySelf(): this {
    return this
  }
  preMultiplySelf(): this {
    return this
  }
  invertSelf(): this {
    return this
  }
  translate(): this {
    return this
  }
  scale(): this {
    return this
  }
}

async function extractPdf(data: Buffer): Promise<string> {
  await ensureDomMatrix()
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
  const doc = await pdfjs.getDocument({ data: new Uint8Array(data), useSystemFonts: true } as never).promise
  const pages: string[] = []
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i)
    const content = await page.getTextContent()
    let line = ''
    let lastY: number | null = null
    const lines: string[] = []
    for (const item of content.items as { str?: string; transform?: number[]; hasEOL?: boolean }[]) {
      if (typeof item.str !== 'string') continue
      const y = item.transform?.[5] ?? null
      if (lastY !== null && y !== null && Math.abs(y - lastY) > 2) {
        lines.push(line.trim())
        line = ''
      }
      line += item.str
      if (item.hasEOL) {
        lines.push(line.trim())
        line = ''
      }
      lastY = y
    }
    if (line.trim()) lines.push(line.trim())
    pages.push(`## Страница ${i}\n${lines.filter(Boolean).join('\n')}`)
  }
  await doc.destroy()
  return pages.join('\n\n')
}
