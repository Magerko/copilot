import type { ChatRequest, ModelInfo, StreamChunk } from '@shared/types'
import { joinUrl, type AdapterDeps, type ProviderAdapter } from './adapter'
import { fromHttp } from './errors'
import { readSse } from './sse'

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
    const body = {
      contents,
      ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}),
      generationConfig: { maxOutputTokens: req.maxTokens, temperature: req.temperature }
    }
    const url = joinUrl(this.deps.cfg.baseUrl, `models/${encodeURIComponent(req.model)}:streamGenerateContent?alt=sse`)
    const res = await this.deps.fetch(url, { method: 'POST', headers: this.headers(), body: JSON.stringify(body), signal })
    if (!res.ok || !res.body) throw fromHttp(res.status, await res.text(), res.headers)
    let usage: { promptTokenCount?: number; candidatesTokenCount?: number } | undefined
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
    if (usage) yield { type: 'usage', inputTokens: usage.promptTokenCount ?? 0, outputTokens: usage.candidatesTokenCount ?? 0 }
  }
}
