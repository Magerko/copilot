import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { extractText } from '../src/main/context/importers'

const fx = (name: string) => join(__dirname, 'fixtures', name)

describe('importers', () => {
  // Guards the packaging: pdfjs needs @napi-rs/canvas for its DOMMatrix polyfill even for text-only extraction.
  it('extracts text from PDF', async () => {
    expect(await extractText(fx('cv.pdf'))).toContain('Senior Backend Engineer, PostgreSQL, Kafka')
  })

  it('extracts text from DOCX', async () => {
    expect(await extractText(fx('cv.docx'))).toContain('Опыт: 5 лет Python, FastAPI, PostgreSQL')
  })

  it('rejects unsupported formats with a readable message', async () => {
    await expect(extractText(fx('cv.docx').replace('.docx', '.pdf') + '.exe')).rejects.toThrow()
  })
})
