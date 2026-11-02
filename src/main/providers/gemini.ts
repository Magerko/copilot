import type { ChatRequest, ModelInfo, StreamChunk } from '@shared/types'
import { joinUrl, type AdapterDeps, type ProviderAdapter } from './adapter'
import { fromHttp } from './errors'
import { readSse } from './sse'

// Room for reasoning on thinking models; the visible length is still bounded by the format in the prompt.
const THINKING_HEADROOM = 2048

type ThinkingLevel = 'minimal' | 'low'

/**
 * Levels to try, lowest first. Gemini 3+ takes thinkingLevel; Flash models also take «minimal» (Flash-Lite even
 * defaults to it, so asking for «low» there made it slower), the rest start at «low». Older models get none.
 */
export function thinkingLevels(model: string): ThinkingLevel[] {
  const m = /gemini-(\d+)/i.exec(model)
  if (!m || Number(m[1]) < 3) return []
  return /flash/i.test(model) ? ['minimal', 'low'] : ['low']
}

export class GeminiAdapter implements ProviderAdapter {
  constructor(private deps: AdapterDeps) {}

  private headers(): Record<string, string> {
    return { 'content-type': 'application/json', 'x-goog-api-key': this.deps.apiKey ?? '' }
  }

  async listModels(signal?: AbortSignal): Promise<ModelInfo[]> {
    const res = await this.deps.fetch(joinUrl(this.deps.cfg.baseUrl, 'models?pageSize=200'), { headers: this.headers(), signal })
    if (!res.ok) throw fromHttp(res.status, await res.text(), res.headers)
    const j = (await res.json()) as {
      models?: { name: string; displayName?: string; supportedGenerationMethods?: string[] }[]
    }
    return (j.models ?? [])
      .filter((m) => m.supportedGenerationMethods?.includes('generateContent'))
      .map((m) => ({ id: m.name.replace(/^models\//, ''), label: m.displayName, vision: /gemini/i.test(m.name) ? true : null }))
  }

  async *stream(req: ChatRequest, signal: AbortSignal): AsyncIterable<StreamChunk> {
    const system = req.messages
      .filter((m) => m.role === 'system')
      .map((m) => m.content)
      .join('\n\n')
    const contents = req.messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [...(m.images ?? []).map((img) => ({ inline_data: { mime_type: img.mime, data: img.base64 } })), { text: m.content }]
      }))
    const body = (thinking: ThinkingLevel | null) => ({
      contents,
      ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}),
      generationConfig: {
        // Thinking tokens count against maxOutputTokens: with a short limit a thinking model spends it all on reasoning
        // and returns an empty answer, so I leave headroom on top of what the visible answer needs.
        maxOutputTokens: req.maxTokens + THINKING_HEADROOM,
        temperature: req.temperature,
        ...(thinking ? { thinkingConfig: { thinkingLevel: thinking } } : {})
      }
    })
    const url = joinUrl(this.deps.cfg.baseUrl, `models/${encodeURIComponent(req.model)}:streamGenerateContent?alt=sse`)
    const send = (thinking: ThinkingLevel | null) =>
      this.deps.fetch(url, { method: 'POST', headers: this.headers(), body: JSON.stringify(body(thinking)), signal })
    // Lowest level first; a model that does not take a level rejects the whole request, so I step to the next one.
    const levels = thinkingLevels(req.model)
    let res = await send(levels[0] ?? null)
    for (let i = 1; i <= levels.length && res.status === 400; i++) {
      const detail = await res.text()
      if (!/thinking/i.test(detail)) throw fromHttp(res.status, detail, res.headers)
      res = await send(levels[i] ?? null)
    }
    if (!res.ok || !res.body) throw fromHttp(res.status, await res.text(), res.headers)
    let usage: { promptTokenCount?: number; candidatesTokenCount?: number; thoughtsTokenCount?: number } | undefined
    for await (const ev of readSse(res.body, signal)) {
      let j: {
        candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] } }[]
        usageMetadata?: typeof usage
        error?: unknown
      }
      try {
        j = JSON.parse(ev.data)
      } catch {
        continue
      }
      if (j.error) throw fromHttp(500, ev.data)
      for (const p of j.candidates?.[0]?.content?.parts ?? []) if (p.text && !p.thought) yield { type: 'text', text: p.text }
      if (j.usageMetadata) usage = j.usageMetadata
    }
    // Thought tokens are reported apart from the answer but billed as output, so the cost estimate includes them.
    if (usage)
      yield { type: 'usage', inputTokens: usage.promptTokenCount ?? 0, outputTokens: (usage.candidatesTokenCount ?? 0) + (usage.thoughtsTokenCount ?? 0) }
  }
}
