import { spawn, type ChildProcess } from 'node:child_process'
import { createServer } from 'node:net'
import { dirname } from 'node:path'
import type { Lang } from '@shared/types'
import type { FetchFn } from '../providers/adapter'

export interface WhisperResult {
  text: string
  lang: string | null
  langProb: number | null
  noSpeech: number
  avgLogprob: number
  ms: number
}

// Whisper's well-known hallucinations on silence/noise, seen in RU/UA/EN subtitles it was trained on.
const HALLUCINATIONS = [
  /^(продолжение следует|субтитры (сделал|создавал|делал)|редактор субтитров|спасибо за просмотр|подписывайтесь)/i,
  /^(thank you( so much)? for watching|thanks for watching|please subscribe|subtitles by)/i,
  /^(дякую за перегляд|субтитри)/i,
  /^[.\s…♪]*$/
]

// On music/noise whisper emits non-speech annotations in brackets/parens/asterisks or musical notes,
// e.g. "[музыка]", "[тревожная музыка]", "(applause)", "[BLANK_AUDIO]", "♪♪". Real speech almost never
// carries them, so I strip them out.
const TAG = /[[({（【][^\])}）】]*[\])}）】]|\*[^*]+\*|[♪♫🎶🎵]+/gu

export function stripTags(text: string): string {
  return text.replace(TAG, ' ').replace(/\s+/g, ' ').trim()
}

export function isHallucination(text: string): boolean {
  const t = text.trim().replace(/^[\s.,!-]+/, '')
  if (!t) return true
  // Nothing but bracketed non-speech tags ("[музыка]") is not speech.
  if (!stripTags(t)) return true
  return HALLUCINATIONS.some((r) => r.test(t))
}

function norm(w: string): string {
  return w.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '')
}

function lev(a: string, b: string): number {
  const n = b.length
  if (!a.length) return n
  if (!n) return a.length
  const d = Array.from({ length: n + 1 }, (_, j) => j)
  for (let i = 1; i <= a.length; i++) {
    let prev = d[0]
    d[0] = i
    for (let j = 1; j <= n; j++) {
      const tmp = d[j]
      d[j] = Math.min(d[j] + 1, d[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1))
      prev = tmp
    }
  }
  return d[n]
}

// The vocabulary used to go into whisper's prompt, but whisper.cpp regurgitates the prompt on noise —
// that is where phantom "Docker"/"Kubernetes" came from. Instead I fix the spelling/casing of a known
// term the model ALREADY produced; a fuzzy match can only rewrite a word that was recognized, never
// insert one that was not spoken. Short terms match on casing only, to avoid "reacts" → "React".
export function applyVocabulary(text: string, vocab: string[]): string {
  const terms = vocab.map((t) => ({ canon: t, key: norm(t) })).filter((t) => t.key.length >= 3)
  if (!terms.length) return text
  return text.replace(/\p{L}[\p{L}\p{N}]*/gu, (word) => {
    const k = norm(word)
    if (k.length < 3) return word
    for (const t of terms) {
      if (k === t.key) return t.canon
      if (t.key.length >= 6 && Math.abs(k.length - t.key.length) <= 2) {
        const d = lev(k, t.key)
        if (d > 0 && d <= Math.floor(t.key.length * 0.2)) return t.canon
      }
    }
    return word
  })
}

export function encodeWav(pcm: Int16Array, sampleRate = 16000): Buffer {
  const data = Buffer.from(pcm.buffer, pcm.byteOffset, pcm.byteLength)
  const h = Buffer.alloc(44)
  h.write('RIFF', 0)
  h.writeUInt32LE(36 + data.length, 4)
  h.write('WAVE', 8)
  h.write('fmt ', 12)
  h.writeUInt32LE(16, 16)
  h.writeUInt16LE(1, 20)
  h.writeUInt16LE(1, 22)
  h.writeUInt32LE(sampleRate, 24)
  h.writeUInt32LE(sampleRate * 2, 28)
  h.writeUInt16LE(2, 32)
  h.writeUInt16LE(16, 34)
  h.write('data', 36)
  h.writeUInt32LE(data.length, 40)
  return Buffer.concat([h, data])
}

async function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const s = createServer()
    s.unref()
    s.on('error', reject)
    s.listen(0, '127.0.0.1', () => {
      const port = (s.address() as { port: number }).port
      s.close(() => resolve(port))
    })
  })
}

export interface SidecarOptions {
  serverPath: string
  modelPath: string
  threads: number
  onExit?: (code: number | null) => void
  onLog?: (line: string) => void
}

export class WhisperSidecar {
  private proc: ChildProcess | null = null
  private port = 0
  private stopping = false

  constructor(
    private opts: SidecarOptions,
    private fetch: FetchFn
  ) {}

  get running(): boolean {
    return !!this.proc && this.proc.exitCode === null
  }

  async start(): Promise<void> {
    this.port = await freePort()
    this.stopping = false
    const args = ['-m', this.opts.modelPath, '--host', '127.0.0.1', '--port', String(this.port), '-t', String(this.opts.threads)]
    this.proc = spawn(this.opts.serverPath, args, { cwd: dirname(this.opts.serverPath), windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] })
    const log = (b: Buffer) => this.opts.onLog?.(b.toString('utf8').trim().slice(0, 300))
    this.proc.stdout?.on('data', log)
    this.proc.stderr?.on('data', log)
    this.proc.on('exit', (code) => {
      this.proc = null
      if (!this.stopping) this.opts.onExit?.(code)
    })
    const deadline = Date.now() + 60_000
    while (Date.now() < deadline) {
      if (!this.running) throw new Error('whisper-server завершился при запуске')
      try {
        const r = await this.fetch(`http://127.0.0.1:${this.port}/`, { signal: AbortSignal.timeout(1000) })
        if (r.status < 500) return
      } catch {
        // server not up yet — keep polling
      }
      await new Promise((r) => setTimeout(r, 200))
    }
    throw new Error('whisper-server не ответил за 60 с')
  }

  stop(): void {
    this.stopping = true
    this.proc?.kill()
    this.proc = null
  }

  async transcribe(pcm: Int16Array, language: 'auto' | Lang, prompt: string, signal?: AbortSignal): Promise<WhisperResult> {
    const t0 = Date.now()
    const form = new FormData()
    form.append('file', new Blob([new Uint8Array(encodeWav(pcm))], { type: 'audio/wav' }), 'audio.wav')
    form.append('response_format', 'verbose_json')
    form.append('language', language)
    form.append('temperature', '0')
    if (prompt) form.append('prompt', prompt)
    const res = await this.fetch(`http://127.0.0.1:${this.port}/inference`, { method: 'POST', body: form, signal })
    if (!res.ok) throw new Error(`whisper HTTP ${res.status}`)
    const j = (await res.json()) as {
      text?: string
      detected_language?: string
      language?: string
      detected_language_probability?: number
      segments?: { text?: string; avg_logprob?: number; no_speech_prob?: number }[]
    }
    const segs = j.segments ?? []
    const noSpeech = segs.length ? Math.min(...segs.map((s) => s.no_speech_prob ?? 0)) : 0
    const avgLogprob = segs.length ? segs.reduce((n, s) => n + (s.avg_logprob ?? 0), 0) / segs.length : 0
    return {
      text: (j.text ?? '').replace(/\s+/g, ' ').trim(),
      lang: j.detected_language ?? j.language ?? null,
      langProb: j.detected_language_probability ?? null,
      noSpeech,
      avgLogprob,
      ms: Date.now() - t0
    }
  }
}
