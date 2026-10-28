import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { FetchFn } from '../providers/adapter'

// I pin to a commit with known hashes: a moving branch could change the data under the same name.
const TESSDATA = 'https://raw.githubusercontent.com/tesseract-ocr/tessdata_fast/87416418657359cb625c412a48b6e1d6d41c29bd'
const SHA256: Record<string, string> = {
  eng: '7d4322bd2a7749724879683fc3912cb542f19906c83bcc1a52132556427170b2',
  rus: 'e16e5e036cce1d9ec2b00063cf8b54472625b9e14d893a169e2b0dedeb4df225',
  ukr: 'd59e53e2bded32f4445f124b4b00240fcac7e8044c003ab822ccb94f0b3db59b'
}
const LANGS = Object.keys(SHA256)

type Worker = { recognize(img: Buffer): Promise<{ data: { text: string } }>; terminate(): Promise<unknown> }

/** Local OCR fallback for models without vision (FR-V06). I download the language data once, then it works offline. */
export class Ocr {
  private worker: Worker | null = null

  constructor(
    private dir: string,
    private fetch: FetchFn
  ) {
    mkdirSync(dir, { recursive: true })
  }

  installed(): boolean {
    return LANGS.every((l) => existsSync(join(this.dir, `${l}.traineddata`)))
  }

  async install(): Promise<void> {
    for (const l of LANGS) {
      const p = join(this.dir, `${l}.traineddata`)
      if (existsSync(p)) continue
      const res = await this.fetch(`${TESSDATA}/${l}.traineddata`)
      if (!res.ok) throw new Error(`OCR-данные ${l}: HTTP ${res.status}`)
      const data = Buffer.from(await res.arrayBuffer())
      if (createHash('sha256').update(data).digest('hex') !== SHA256[l]) throw new Error(`OCR-данные ${l}: контрольная сумма не совпала — файл не сохранён`)
      writeFileSync(p, data)
    }
  }

  async recognize(png: Buffer): Promise<string> {
    if (!this.installed()) throw new Error('OCR не установлен — скачайте языковые данные в «Диагностике»')
    if (!this.worker) {
      const { createWorker } = await import('tesseract.js')
      this.worker = (await createWorker(LANGS.join('+'), 1, { langPath: this.dir, cachePath: this.dir, gzip: false })) as unknown as Worker
    }
    const r = await this.worker.recognize(png)
    return r.data.text.trim()
  }

  async dispose(): Promise<void> {
    await this.worker?.terminate()
    this.worker = null
  }
}
