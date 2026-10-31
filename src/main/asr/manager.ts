import type { AsrStatus, Lang, Source, TranscriptSegment } from '@shared/types'
import type { FetchFn } from '../providers/adapter'
import { AsrAssets, macInstallHint, MODELS, type AsrBackend } from './assets'
import type { SileroGate } from './silero'
import { applyVocabulary, diagnoseWhisperFailure, isHallucination, stripTags, WhisperSidecar } from './whisper'
import { t } from '@shared/i18n'

// Silero needs at least this much detected speech in a clip; below it the clip is music/noise/silence and never reaches whisper.
const MIN_SPEECH_S = 0.2

export interface AsrJob {
  sessionId: string
  utteranceId: string
  source: Source
  pcm: Int16Array
  startMs: number
  endMs: number
  final: boolean
}

export interface AsrConfig {
  backend: AsrBackend
  model: string
  language: 'auto' | Lang
  vocabulary: string[]
  threads: number
}

export interface AsrEvents {
  segment(seg: TranscriptSegment): void
  status(s: AsrStatus): void
  log(kind: string, data: unknown): void
}

const LANGS = new Set(['ru', 'uk', 'en'])

/**
 * I serialize work for the single whisper-server. I never drop finals; a partial is
 * superseded by any newer partial or final of the same utterance, so the queue cannot grow.
 */
export class AsrManager {
  private sidecar: WhisperSidecar | null = null
  // One start at a time: settings and the installer both call ensure() at once, and two starts left an orphan server.
  private starting: Promise<boolean> | null = null
  private queue: AsrJob[] = []
  private busy = false
  private restarts = 0
  private st: AsrStatus

  constructor(
    private assets: AsrAssets,
    private fetch: FetchFn,
    private cfg: AsrConfig,
    private ev: AsrEvents,
    private silero?: SileroGate
  ) {
    this.st = { binary: false, model: cfg.model, modelPresent: false, running: false, lastLatencyMs: null, download: null, error: null }
    this.refreshStatus()
  }

  get status(): AsrStatus {
    return this.st
  }

  setConfig(cfg: AsrConfig): void {
    const restart = cfg.model !== this.cfg.model || cfg.backend !== this.cfg.backend || cfg.threads !== this.cfg.threads
    this.cfg = cfg
    if (restart && this.sidecar) {
      this.stop()
      void this.ensure()
    }
    this.refreshStatus()
  }

  resetSession(): void {
    this.queue = []
  }

  setDownload(d: AsrStatus['download'], error: string | null = null): void {
    this.st = { ...this.st, download: d, error }
    this.refreshStatus()
  }

  refreshStatus(): void {
    this.st = {
      ...this.st,
      model: this.cfg.model,
      binary: !!this.assets.serverPath(this.cfg.backend),
      modelPresent: this.assets.hasModel(this.cfg.model),
      running: !!this.sidecar?.running
    }
    this.ev.status(this.st)
  }

  ensure(): Promise<boolean> {
    if (this.sidecar?.running) return Promise.resolve(true)
    if (!this.starting) {
      const p: Promise<boolean> = this.startSidecar().finally(() => {
        if (this.starting === p) this.starting = null
      })
      this.starting = p
    }
    return this.starting
  }

  private async startSidecar(): Promise<boolean> {
    const server = this.assets.serverPath(this.cfg.backend)
    if (!server || !this.assets.hasModel(this.cfg.model)) {
      this.st = {
        ...this.st,
        error: !server
          ? process.platform === 'darwin'
            ? macInstallHint()
            : t('Не установлен движок распознавания')
          : t('Нет модели {name}', { name: MODELS[this.cfg.model] ? t(MODELS[this.cfg.model].label) : this.cfg.model })
      }
      this.refreshStatus()
      return false
    }
    // I keep a local handle: by the time an await returns, this.sidecar may already belong to a newer start or be null.
    const sc: WhisperSidecar = new WhisperSidecar(
      {
        serverPath: server,
        modelPath: this.assets.modelPath(this.cfg.model),
        threads: this.cfg.threads,
        onLog: (line) => {
          if (/error|fail|cuda|gpu/i.test(line)) this.ev.log('asr_log', line)
        },
        onExit: (code) => {
          if (this.sidecar !== sc) return // an old server that was replaced or stopped on purpose
          const output = sc.recentOutput
          const hint = diagnoseWhisperFailure(code, output)
          this.ev.log('asr_exit', { code, hint, output: output.slice(-6) })
          this.sidecar = null
          this.st = { ...this.st, error: t('Распознавание остановилось (код {code})', { code: String(code) }) + (hint ? `: ${hint}` : ` — ${t('перезапуск')}`) }
          this.refreshStatus()
          if (this.restarts++ < 3) setTimeout(() => void this.ensure(), 1000)
        }
      },
      this.fetch
    )
    this.sidecar = sc
    try {
      await sc.start()
      if (this.sidecar !== sc) {
        // stop() or a model switch happened while it was starting: this server is no longer wanted
        sc.stop()
        return false
      }
      this.st = { ...this.st, error: null }
      this.refreshStatus()
      // GPU builds pay 13–27 s on the first request (spike S2), so I warm it up before the user speaks.
      void sc.transcribe(new Int16Array(16000), 'en', '').catch(() => {})
      return true
    } catch (e) {
      sc.stop()
      if (this.sidecar !== sc) return false
      const message = e instanceof Error ? e.message : String(e)
      this.ev.log('asr_start_fail', { backend: this.cfg.backend, model: this.cfg.model, message })
      this.sidecar = null
      this.st = { ...this.st, error: message }
      this.refreshStatus()
      return false
    }
  }

  stop(): void {
    this.sidecar?.stop()
    this.sidecar = null
    // a start still in flight sees it was superseded and stops its server; the next ensure() starts afresh
    this.starting = null
    this.queue = []
    this.refreshStatus()
  }

  push(job: AsrJob): void {
    this.queue = this.queue.filter((j) => j.final || j.utteranceId !== job.utteranceId)
    if (!job.final && this.queue.some((j) => !j.final && j.source === job.source)) {
      this.queue = this.queue.filter((j) => j.final || j.source !== job.source)
    }
    this.queue.push(job)
    this.queue.sort((a, b) => Number(b.final) - Number(a.final))
    void this.pump()
  }

  private async pump(): Promise<void> {
    if (this.busy) return
    this.busy = true
    try {
      while (this.queue.length) {
        const job = this.queue.shift()!
        if (!(await this.ensure())) {
          if (job.final) this.emit(job, '', null)
          continue
        }
        // Silero speech gate: drop music/noise/silence before whisper so it can't hallucinate on them.
        if (this.silero) {
          const speechS = await this.silero.speechSeconds(job.pcm)
          if (speechS >= 0 && speechS < MIN_SPEECH_S) {
            if (job.final) {
              this.ev.log('asr_nonspeech', { audioMs: Math.round(job.pcm.length / 16), speechMs: Math.round(speechS * 1000) })
              this.emit(job, '', null)
            }
            continue
          }
        }
        const lang = this.cfg.language
        // The model may have been switched during the speech check above; then I wait for the new server.
        const sc = this.sidecar?.running ? this.sidecar : (await this.ensure()) ? this.sidecar : null
        if (!sc) {
          if (job.final) this.emit(job, '', null)
          continue
        }
        try {
          // No vocabulary in the prompt: whisper.cpp echoes the prompt on noise (phantom "Docker"/"Kubernetes").
          const r = await sc.transcribe(job.pcm, lang, '')
          this.st = { ...this.st, lastLatencyMs: r.ms }
          if (job.final) {
            this.ev.status(this.st)
            this.ev.log('asr_latency', { ms: r.ms, audioMs: Math.round(job.pcm.length / 16), lang, model: this.cfg.model, backend: this.cfg.backend })
          }
          const garbage = isHallucination(r.text) || (r.noSpeech > 0.6 && r.avgLogprob < -1)
          let text = garbage ? '' : stripTags(r.text)
          if (text) text = applyVocabulary(text, this.cfg.vocabulary)
          this.emit(job, text, r.lang && LANGS.has(r.lang) ? r.lang : null)
        } catch (e) {
          this.ev.log('asr_error', { message: e instanceof Error ? e.message : String(e) })
          if (job.final) this.emit(job, '', null)
        }
      }
    } finally {
      this.busy = false
    }
  }

  private emit(job: AsrJob, text: string, lang: string | null): void {
    this.ev.segment({
      sessionId: job.sessionId,
      segmentId: job.utteranceId,
      source: job.source,
      startMs: job.startMs,
      endMs: job.endMs,
      text,
      isFinal: job.final,
      lang
    })
  }
}
