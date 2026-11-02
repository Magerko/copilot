import { describe, expect, it } from 'vitest'
import { GeminiAdapter, thinkingLevels } from '../src/main/providers/gemini'

const sse = (...events: unknown[]) =>
  new Response(events.map((e) => `data: ${JSON.stringify(e)}\n\n`).join(''), { status: 200, headers: { 'content-type': 'text/event-stream' } })

function adapter(responses: Response[]) {
  const bodies: Record<string, unknown>[] = []
  const fetch = (async (_url: string, init?: RequestInit) => {
    bodies.push(JSON.parse(String(init?.body)))
    return responses.shift()!
  }) as never
  const cfg = {
    id: 'g',
    label: 'Gemini',
    preset: 'gemini',
    protocol: 'gemini',
    baseUrl: 'https://example.test/v1beta',
    hasKey: true,
    allowFallback: false,
    timeoutMs: 5000
  }
  return { a: new GeminiAdapter({ fetch, cfg, apiKey: 'k' } as never), bodies }
}

async function collect(a: GeminiAdapter, model: string) {
  const out: unknown[] = []
  for await (const c of a.stream({ model, messages: [{ role: 'user', content: 'hi' }], maxTokens: 64, temperature: 0 }, new AbortController().signal))
    out.push(c)
  return out
}

describe('Gemini thinking models', () => {
  it('tries the lowest thinking level each model family takes', () => {
    expect(thinkingLevels('gemini-3.5-flash-lite')).toEqual(['minimal', 'low'])
    expect(thinkingLevels('gemini-3.5-flash')).toEqual(['minimal', 'low'])
    expect(thinkingLevels('gemini-3.1-pro-preview')).toEqual(['low'])
    expect(thinkingLevels('gemini-2.5-flash')).toEqual([])
  })

  it('asks for minimal thinking and leaves room for it, so a short answer is not eaten by reasoning', async () => {
    const { a, bodies } = adapter([
      sse({ candidates: [{ content: { parts: [{ text: 'OK' }] } }], usageMetadata: { promptTokenCount: 3, candidatesTokenCount: 1, thoughtsTokenCount: 40 } })
    ])
    const out = await collect(a, 'gemini-3.5-flash')
    const cfg = bodies[0].generationConfig as Record<string, unknown>
    expect(cfg.thinkingConfig).toEqual({ thinkingLevel: 'minimal' })
    expect(cfg.maxOutputTokens).toBeGreaterThan(64)
    expect(out).toContainEqual({ type: 'text', text: 'OK' })
    expect(out).toContainEqual({ type: 'usage', inputTokens: 3, outputTokens: 41 })
  })

  it('steps up from «minimal» to «low» and then to no level when the model rejects them', async () => {
    const reject = () => new Response('{"error":{"message":"thinking_level value is not supported for this model"}}', { status: 400 })
    const { a, bodies } = adapter([reject(), reject(), sse({ candidates: [{ content: { parts: [{ text: 'OK' }] } }] })])
    expect(await collect(a, 'gemini-3.9-flash')).toContainEqual({ type: 'text', text: 'OK' })
    const levels = bodies.map((b) => ((b.generationConfig as Record<string, unknown>).thinkingConfig as { thinkingLevel?: string } | undefined)?.thinkingLevel)
    expect(levels).toEqual(['minimal', 'low', undefined])
  })
})
