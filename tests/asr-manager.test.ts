import { describe, expect, it, vi } from 'vitest'

// A fake whisper-server: start() resolves when the test says so; every instance is recorded.
const servers: FakeSidecar[] = []
class FakeSidecar {
  stopped = false
  started = false
  private release!: () => void
  readonly ready = new Promise<void>((r) => (this.release = r))
  constructor(readonly opts: { modelPath: string }) {
    servers.push(this)
  }
  get running() {
    return this.started && !this.stopped
  }
  get recentOutput() {
    return []
  }
  async start() {
    await this.ready
    this.started = true
  }
  finishStart() {
    this.release()
  }
  stop() {
    this.stopped = true
  }
  async transcribe() {
    if (this.stopped) throw new Error('stopped')
    return { text: 'привіт', lang: 'uk', ms: 5, noSpeech: 0, avgLogprob: 0 }
  }
}

vi.mock('../src/main/asr/whisper', async (orig) => ({ ...(await orig<object>()), WhisperSidecar: FakeSidecar }))

const { AsrManager } = await import('../src/main/asr/manager')

function setup() {
  servers.length = 0
  const assets = { serverPath: () => '/bin/whisper-server', hasModel: () => true, modelPath: (m: string) => `/models/${m}.bin` }
  const ev = { status: () => {}, segment: vi.fn(), log: () => {} }
  const mgr = new AsrManager(assets as never, (() => Promise.reject(new Error('no net'))) as never, { backend: 'cpu', model: 'small', language: 'uk', vocabulary: [], threads: 8 }, ev)
  return { mgr, ev }
}

describe('AsrManager start races', () => {
  it('two ensure() calls at once start only one server', async () => {
    const { mgr } = setup()
    const a = mgr.ensure()
    const b = mgr.ensure()
    expect(servers).toHaveLength(1)
    servers[0].finishStart()
    expect(await a).toBe(true)
    expect(await b).toBe(true)
  })

  it('switching the model while a server starts stops the old one and starts the new model', async () => {
    const { mgr } = setup()
    void mgr.ensure()
    await Promise.resolve()
    mgr.setConfig({ backend: 'cpu', model: 'turbo', language: 'uk', vocabulary: [], threads: 8 })
    servers[0].finishStart()
    await vi.waitFor(() => expect(servers).toHaveLength(2))
    servers[1].finishStart()
    await vi.waitFor(() => expect(servers[1].running).toBe(true))
    expect(servers[0].stopped).toBe(true)
    expect(servers[1].opts.modelPath).toBe('/models/turbo.bin')
    expect(mgr.status.error).toBeNull()
  })
})
