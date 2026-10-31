import type { AppError, ChatRequest } from '@shared/types'
import type { ProviderAdapter } from './adapter'
import { appError, isRetryable, toAppError, ProviderError } from './errors'
import { t } from '@shared/i18n'

export interface RunCallbacks {
  onText(delta: string): void
  onFirstToken?(ms: number): void
}

export interface RunResult {
  text: string
  firstTokenMs: number | null
  latencyMs: number
  usage: { inputTokens: number; outputTokens: number; exact: boolean }
}

export interface RunOptions {
  timeoutMs: number
  retries?: number
  baseDelayMs?: number
  idleMs?: number
  sleep?: (ms: number) => Promise<void>
}

const defaultSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

/**
 * I stream one request with bounded retries. I retry only before the first token:
 * replaying after partial output would show the user two different answers.
 */
export async function runStream(adapter: ProviderAdapter, req: ChatRequest, signal: AbortSignal, cb: RunCallbacks, opts: RunOptions): Promise<RunResult> {
  const retries = opts.retries ?? 2
  const sleep = opts.sleep ?? defaultSleep
  const started = Date.now()
  let lastErr: AppError | null = null

  for (let attempt = 0; attempt <= retries; attempt++) {
    if (signal.aborted) throw new ProviderError(appError('cancelled'))
    const ctrl = new AbortController()
    const onAbort = () => ctrl.abort()
    signal.addEventListener('abort', onAbort)
    let timedOut = false
    const fire = () => {
      timedOut = true
      ctrl.abort()
    }
    let timer = setTimeout(fire, opts.timeoutMs)
    // After the first token I turn the deadline into a stall timer: a stream that goes silent must not hold its slot forever.
    const idleMs = opts.idleMs ?? Math.max(opts.timeoutMs, 20_000)
    let text = ''
    let firstTokenMs: number | null = null
    let usage: RunResult['usage'] | null = null
    const filter = new ThinkFilter()
    try {
      for await (const chunk of adapter.stream(req, ctrl.signal)) {
        if (firstTokenMs !== null) {
          clearTimeout(timer)
          timer = setTimeout(fire, idleMs)
        }
        if (chunk.type === 'usage') {
          usage = { inputTokens: chunk.inputTokens, outputTokens: chunk.outputTokens, exact: true }
          continue
        }
        const visible = filter.push(chunk.text)
        if (!visible) continue
        if (firstTokenMs === null) {
          firstTokenMs = Date.now() - started
          clearTimeout(timer)
          timer = setTimeout(fire, idleMs)
          cb.onFirstToken?.(firstTokenMs)
        }
        text += visible
        cb.onText(visible)
      }
      clearTimeout(timer)
      return {
        text,
        firstTokenMs,
        latencyMs: Date.now() - started,
        usage: usage ?? { inputTokens: estimateTokens(req), outputTokens: Math.ceil(text.length / 3.5), exact: false }
      }
    } catch (e) {
      clearTimeout(timer)
      if (signal.aborted) throw new ProviderError(appError('cancelled'))
      const err = timedOut
        ? appError('timeout', firstTokenMs === null ? t('нет ответа за {ms} мс', { ms: opts.timeoutMs }) : t('ответ замер на {ms} мс', { ms: idleMs }))
        : toAppError(e)
      if (firstTokenMs !== null) throw new ProviderError({ ...err, detail: t('оборвано после начала ответа: {detail}', { detail: err.detail ?? '' }) })
      lastErr = err
      if (!isRetryable(err) || attempt === retries) throw new ProviderError(err)
      await sleep(Math.min(5000, err.retryAfterMs ?? (opts.baseDelayMs ?? 600) * 2 ** attempt))
    } finally {
      signal.removeEventListener('abort', onAbort)
    }
  }
  throw new ProviderError(lastErr ?? appError('unknown'))
}

export function estimateTokens(req: ChatRequest): number {
  return Math.ceil(req.messages.reduce((n, m) => n + m.content.length, 0) / 3.5)
}

/** Local reasoning models (qwen3 etc. via Ollama) may inline <think>…</think>; I never show it as an answer. */
export class ThinkFilter {
  private inThink = false
  private pending = ''

  push(chunk: string): string {
    let s = this.pending + chunk
    this.pending = ''
    let out = ''
    while (s.length) {
      if (this.inThink) {
        const end = s.indexOf('</think>')
        if (end < 0) {
          this.pending = tailPrefix(s, '</think>')
          return out
        }
        s = s.slice(end + 8)
        this.inThink = false
        s = s.replace(/^\s+/, '')
      } else {
        const start = s.indexOf('<think>')
        if (start < 0) {
          const keep = tailPrefix(s, '<think>')
          out += s.slice(0, s.length - keep.length)
          this.pending = keep
          return out
        }
        out += s.slice(0, start)
        s = s.slice(start + 7)
        this.inThink = true
      }
    }
    return out
  }
}

function tailPrefix(s: string, tag: string): string {
  for (let n = Math.min(tag.length - 1, s.length); n > 0; n--) if (tag.startsWith(s.slice(-n))) return s.slice(-n)
  return ''
}
