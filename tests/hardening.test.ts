import { describe, expect, it } from 'vitest'
import type { ChatRequest, StreamChunk } from '@shared/types'
import { BudgetManager } from '../src/main/budget/budget'
import { chunkText } from '../src/main/context/retrieval'
import type { ProviderAdapter } from '../src/main/providers/adapter'
import { fromHttp } from '../src/main/providers/errors'
import { isLocalTarget } from '../src/main/providers/registry'
import { runStream } from '../src/main/providers/runner'

const req: ChatRequest = { model: 'm', messages: [{ role: 'user', content: 'q' }], maxTokens: 10, temperature: 0 }

function adapter(stream: (signal: AbortSignal, call: number) => AsyncIterable<StreamChunk>): ProviderAdapter {
  let call = 0
  return { listModels: async () => [], stream: (_r, signal) => stream(signal, call++) }
}

describe('hardening (audit P3)', () => {
  it('Ollama cloud models are not local even on loopback', () => {
    expect(isLocalTarget('http://127.0.0.1:11434/v1', 'qwen2.5:14b-instruct-q5_K_M')).toBe(true)
    expect(isLocalTarget('http://127.0.0.1:11434/v1', 'gpt-oss:120b-cloud')).toBe(false)
    expect(isLocalTarget('http://127.0.0.1:11434/v1', 'deepseek-v3.1:cloud')).toBe(false)
    expect(isLocalTarget('https://api.openai.com/v1', 'gpt-5')).toBe(false)
  })

  it('waits Retry-After before retrying a 429', async () => {
    const slept: number[] = []
    const a = adapter(async function* (_s, call) {
      if (call === 0) throw fromHttp(429, '{}', new Headers({ 'retry-after': '2' }))
      yield { type: 'text', text: 'ok' }
    })
    const r = await runStream(a, req, new AbortController().signal, { onText: () => {} }, { timeoutMs: 1000, sleep: async (ms) => void slept.push(ms) })
    expect(r.text).toBe('ok')
    expect(slept).toEqual([2000])
  })

  it('a stream that stalls after the first token times out instead of hanging', async () => {
    const a = adapter(async function* (signal) {
      yield { type: 'text', text: 'Начало' }
      await new Promise((_, rej) => signal.addEventListener('abort', () => rej(new Error('aborted'))))
    })
    const t0 = Date.now()
    await expect(runStream(a, req, new AbortController().signal, { onText: () => {} }, { timeoutMs: 1000, idleMs: 50 })).rejects.toMatchObject({
      appError: { code: 'timeout' }
    })
    expect(Date.now() - t0).toBeLessThan(1000)
  })

  it('chunkText keeps every character of a long line without spaces', () => {
    const line = 'x'.repeat(1515)
    expect(
      chunkText(line)
        .map((c) => c.text)
        .join('')
    ).toBe(line)
  })

  it('the daily budget restarts after midnight', () => {
    let now = new Date(2026, 9, 28, 23, 59).getTime()
    const b = new BudgetManager(
      { perSessionUsd: null, perDayUsd: 1, requestsPerMinute: 100, maxConcurrent: 5 },
      { 'p/m': { inputPerMTok: 1_000_000, outputPerMTok: 0 } },
      { now: () => now, spentTodayBefore: () => 0 }
    )
    b.begin()
    b.end('p', 'm', false, { inputTokens: 2, outputTokens: 0 })
    expect(b.canStart(false).ok).toBe(false)
    now = new Date(2026, 9, 29, 0, 1).getTime()
    expect(b.canStart(false).ok).toBe(true)
  })
})
