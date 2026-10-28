import { readFile, stat } from 'node:fs/promises'
import { extname } from 'node:path'

const MAX_BYTES = 15 * 1024 * 1024

/** I extract text locally only (FR-C01): nothing leaves the machine during import. */
export async function extractText(filePath: string): Promise<string> {
  const st = await stat(filePath)
  if (st.size > MAX_BYTES) throw new Error('Файл больше 15 МБ')
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
      throw new Error(`Формат ${ext || 'без расширения'} не поддерживается — используйте PDF, DOCX, TXT или MD`)
  }
}

async function extractPdf(data: Buffer): Promise<string> {
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
