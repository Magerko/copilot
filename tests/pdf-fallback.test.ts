import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { ensureDomMatrix, extractText } from '../src/main/context/importers'

describe('pdf import without @napi-rs/canvas', () => {
  // A cross-platform build ships no canvas binary for the target OS; pdfjs must still load and extract text.
  it('falls back to a DOMMatrix stub and still extracts text', async () => {
    delete (globalThis as { DOMMatrix?: unknown }).DOMMatrix
    await ensureDomMatrix(() => Promise.reject(new Error('no binary')))
    const M = (globalThis as { DOMMatrix?: new () => { a: number; d: number } }).DOMMatrix!
    expect(new M()).toMatchObject({ a: 1, d: 1 })
    expect(await extractText(join(__dirname, 'fixtures', 'cv.pdf'))).toContain('Senior Backend Engineer, PostgreSQL, Kafka')
  })
})
