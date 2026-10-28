import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createAdapter } from '../src/main/providers/factory'
import { runStream, ThinkFilter } from '../src/main/providers/runner'
import { NetGuard } from '../src/main/net/guard'
import { fromHttp, ProviderError } from '../src/main/providers/errors'
import { registerSecret } from '../src/main/storage/redact'
import type { ChatRequest, ProviderConfig, ProviderProtocol } from '../src/shared/types'

type Mode = 'ok' | 'status' | 'hang' | 'flaky' | 'reject-temp'
let mode: Mode = 'ok'
let statusCode = 500
let hits = 0
let lastBody: Record<string, unknown> = {}
let lastHeaders: IncomingMessage['headers'] = {}
let server: Server
let base = ''

function sse(res: ServerResponse, events: { event?: string; data: unknown }[]) {
  res.writeHead(200, { 'content-type': 'text/event-stream' })
  for (const e of events) {
    if (e.event) res.write(`event: ${e.event}\n`)
    res.write(`data: ${typeof e.data === 'string' ? e.data : JSON.stringify(e.data)}\n\n`)
  }
  res.end()
}

function reply(proto: ProviderProtocol, res: ServerResponse) {
  if (proto === 'openai') {
    sse(res, [
      { data: { choices: [{ delta: { content: '<think>secret plan</think>Idem' } }] } },
      { data: { choices: [{ delta: { content: 'potency.' } }] } },
      { data: { choices: [], usage: { prompt_tokens: 12, completion_tokens: 3 } } },
      { data: '[DONE]' }
    ])
  } else if (proto === 'anthropic') {
    sse(res, [
      {
        event: 'message_start',
        data: {
          type: 'message_start',
          message: { id: 'm', type: 'message', role: 'assistant', model: 'x', content: [], stop_reason: null, usage: { input_tokens: 12, output_tokens: 0 } }
        }
      },
      { event: 'content_block_start', data: { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } } },
      { event: 'content_block_delta', data: { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: 'Idem' } } },
      { event: 'content_block_delta', data: { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: 'potency.' } } },
      { event: 'content_block_stop', data: { type: 'content_block_stop', index: 0 } },
      { event: 'message_delta', data: { type: 'message_delta', delta: { stop_reason: 'end_turn' }, usage: { output_tokens: 3 } } },
      { event: 'message_stop', data: { type: 'message_stop' } }
    ])
  } else {
    sse(res, [
      { data: { candidates: [{ content: { parts: [{ text: 'Idem' }] } }] } },
      { data: { candidates: [{ content: { parts: [{ text: 'potency.' }] } }], usageMetadata: { promptTokenCount: 12, candidatesTokenCount: 3 } } }
    ])
  }
}

beforeAll(async () => {
  server = createServer((req, res) => {
    let body = ''
    req.on('data', (c) => (body += c))
    req.on('end', () => {
      if (req.url === '/bounce-out') return void res.writeHead(302, { location: 'https://example.com/' }).end()
      if (req.url === '/bounce-in') return void res.writeHead(302, { location: '/openai/v1/models' }).end()
      hits++
      lastHeaders = req.headers
      try {
        lastBody = body ? JSON.parse(body) : {}
      } catch {
        lastBody = {}
      }
      const proto: ProviderProtocol = req.url!.startsWith('/anthropic') ? 'anthropic' : req.url!.startsWith('/gemini') ? 'gemini' : 'openai'
      if (req.method === 'GET') {
        res.writeHead(200, { 'content-type': 'application/json' })
        if (proto === 'gemini') res.end(JSON.stringify({ models: [{ name: 'models/gemini-x', supportedGenerationMethods: ['generateContent'] }] }))
        else if (proto === 'anthropic')
          res.end(
            JSON.stringify({
              data: [{ id: 'claude-x', display_name: 'Claude X', type: 'model', created_at: '2026-01-01T00:00:00Z' }],
              has_more: false,
              first_id: 'claude-x',
              last_id: 'claude-x'
            })
          )
        else res.end(JSON.stringify({ data: [{ id: 'gpt-x' }, { id: 'text-embedding-3' }] }))
        return
      }
      if (mode === 'hang') return
      if (mode === 'status' || (mode === 'flaky' && hits % 3 !== 0)) {
        res.writeHead(statusCode, { 'content-type': 'application/json' })
        res.end(JSON.stringify({ error: { message: statusCode === 402 ? 'insufficient_quota' : 'boom' } }))
        return
      }
      if (mode === 'reject-temp' && 'temperature' in lastBody) {
        res.writeHead(400, { 'content-type': 'application/json' })
        res.end(JSON.stringify({ error: { message: "Unsupported parameter: 'temperature'" } }))
        return
      }
      reply(proto, res)
    })
  })
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', () => r()))
  base = `http://127.0.0.1:${(server.address() as { port: number }).port}`
})

afterAll(() => {
  server.close()
})

const guard = new NetGuard()
function adapter(protocol: ProviderProtocol, preset: ProviderConfig['preset'] = 'custom') {
  const path = protocol === 'openai' ? '/openai/v1' : `/${protocol}`
  const cfg: ProviderConfig = { id: 'p', label: 'P', preset, protocol, baseUrl: base + path, hasKey: true, allowFallback: false, timeoutMs: 1500 }
  return createAdapter({ cfg, apiKey: 'sk-test-key-1234567890', fetch: guard.fetch })
}
const req: ChatRequest = {
  model: 'm',
  messages: [
    { role: 'system', content: 'sys' },
    { role: 'user', content: 'q' }
  ],
  maxTokens: 100,
  temperature: 0.3
}
const noSleep = { sleep: async () => {} }

describe.each(['openai', 'anthropic', 'gemini'] as ProviderProtocol[])('%s adapter', (proto) => {
  it('streams text and usage', async () => {
    mode = 'ok'
    let streamed = ''
    const r = await runStream(adapter(proto), req, new AbortController().signal, { onText: (t) => (streamed += t) }, { timeoutMs: 1500 })
    expect(r.text).toBe('Idempotency.')
    expect(streamed).toBe('Idempotency.')
    expect(r.usage).toMatchObject({ inputTokens: 12, outputTokens: 3, exact: true })
    expect(r.firstTokenMs).not.toBeNull()
  })

  it('lists models', async () => {
    const models = await adapter(proto).listModels()
    expect(models.length).toBeGreaterThan(0)
  })

  it.each([
    [401, 'auth'],
    [402, 'quota'],
    [404, 'not_found'],
    [400, 'bad_request']
  ])('maps HTTP %i to %s without retries', async (status, code) => {
    mode = 'status'
    statusCode = status
    hits = 0
    const p = runStream(adapter(proto), req, new AbortController().signal, { onText: () => {} }, { timeoutMs: 1500, ...noSleep })
    await expect(p).rejects.toMatchObject({ appError: { code } })
    expect(hits).toBe(1)
  })

  it('429 and 5xx retry at most twice', async () => {
    mode = 'status'
    statusCode = 429
    hits = 0
    await expect(runStream(adapter(proto), req, new AbortController().signal, { onText: () => {} }, { timeoutMs: 1500, ...noSleep })).rejects.toMatchObject({
      appError: { code: 'rate_limit' }
    })
    expect(hits).toBe(3)
    mode = 'flaky'
    statusCode = 503
    hits = 0
    const r = await runStream(adapter(proto), req, new AbortController().signal, { onText: () => {} }, { timeoutMs: 1500, ...noSleep })
    expect(r.text).toBe('Idempotency.')
  })

  it('times out a hung request and cancel() aborts', async () => {
    mode = 'hang'
    await expect(runStream(adapter(proto), req, new AbortController().signal, { onText: () => {} }, { timeoutMs: 300, retries: 0 })).rejects.toMatchObject({
      appError: { code: 'timeout' }
    })
    const ctrl = new AbortController()
    const p = runStream(adapter(proto), req, ctrl.signal, { onText: () => {} }, { timeoutMs: 5000, retries: 0 })
    setTimeout(() => ctrl.abort(), 100)
    await expect(p).rejects.toMatchObject({ appError: { code: 'cancelled' } })
  })
})

describe('openai specifics', () => {
  it('drops a rejected optional parameter and retries once', async () => {
    mode = 'reject-temp'
    const r = await runStream(adapter('openai'), req, new AbortController().signal, { onText: () => {} }, { timeoutMs: 1500 })
    expect(r.text).toBe('Idempotency.')
    expect('temperature' in lastBody).toBe(false)
  })

  it('openai preset filters non-chat models and uses max_completion_tokens', async () => {
    mode = 'ok'
    const models = await adapter('openai', 'openai').listModels()
    expect(models.map((m) => m.id)).toEqual(['gpt-x'])
    await runStream(adapter('openai', 'openai'), req, new AbortController().signal, { onText: () => {} }, { timeoutMs: 1500 })
    expect(lastBody.max_completion_tokens).toBe(100)
    expect(lastHeaders.authorization).toBe('Bearer sk-test-key-1234567890')
  })
})

describe('offline guard', () => {
  it('blocks non-loopback requests before any network IO', async () => {
    const g = new NetGuard()
    g.setOffline(true)
    const blocked: string[] = []
    g.onBlocked((u) => blocked.push(u))
    await expect(g.fetch('https://api.openai.com/v1/models')).rejects.toBeInstanceOf(ProviderError)
    await expect(g.fetch('https://api.openai.com/v1/models')).rejects.toMatchObject({ appError: { code: 'offline_blocked' } })
    expect(blocked[0]).toBe('https://api.openai.com/v1/models')
    const res = await g.fetch(`${base}/openai/v1/models`)
    expect(res.ok).toBe(true)
  })

  it('a loopback redirect cannot carry an offline request to the internet', async () => {
    const g = new NetGuard()
    g.setOffline(true)
    await expect(g.fetch(`${base}/bounce-out`)).rejects.toMatchObject({ appError: { code: 'offline_blocked' } })
    const res = await g.fetch(`${base}/bounce-in`)
    expect(res.ok).toBe(true)
  })

  it('rejects dangerous schemes and credentials in URLs', () => {
    const g = new NetGuard()
    expect(() => g.assertAllowed('file:///C:/Windows/win.ini')).toThrow()
    expect(() => g.assertAllowed('https://user:pass@example.com/v1')).toThrow()
  })
})

describe('ThinkFilter', () => {
  it('removes think blocks split across chunks', () => {
    const f = new ThinkFilter()
    const out = ['<thi', 'nk>hidden</th', 'ink>Visible', ' text'].map((c) => f.push(c)).join('')
    expect(out).toBe('Visible text')
  })
})

describe('error details', () => {
  it('never carry the API key echoed by the provider', () => {
    registerSecret('amkPLAINKEY9f8e7d6c5b4a3210')
    const e = fromHttp(401, '{"error":"Invalid API key: amkPLAINKEY9f8e7d6c5b4a3210 (header: Bearer amkPLAINKEY9f8e7d6c5b4a3210)"}')
    expect(e.appError.code).toBe('auth')
    expect(e.appError.detail).not.toContain('amkPLAINKEY')
  })
})
