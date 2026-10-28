import type { ChatMessage, ChatRequest, ModelInfo, StreamChunk } from '@shared/types'
import { joinUrl, type AdapterDeps, type ProviderAdapter } from './adapter'
import { fromHttp, ProviderError, rejectsParam } from './errors'
import { readSse } from './sse'

const NON_CHAT = /embed|whisper|tts|dall-e|moderation|transcribe|realtime|audio|image|search|computer-use|sora/i
const OPTIONAL_PARAMS = ['temperature', 'stream_options', 'max_completion_tokens', 'max_tokens']

/** OpenAI Chat Completions and every OpenAI-compatible server (AnyModel, Ollama /v1, LM Studio, vLLM, LiteLLM). */
export class OpenAiAdapter implements ProviderAdapter {
  private dropped = new Set<string>()

  constructor(private deps: AdapterDeps) {}

  private headers(): Record<string, string> {
    const h: Record<string, string> = { 'content-type': 'application/json' }
    if (this.deps.apiKey) h.authorization = `Bearer ${this.deps.apiKey}`
    return h
  }

  async listModels(signal?: AbortSignal): Promise<ModelInfo[]> {
    const res = await this.deps.fetch(joinUrl(this.deps.cfg.baseUrl, 'models'), { headers: this.headers(), signal })
    if (!res.ok) throw fromHttp(res.status, await res.text(), res.headers)
    const j = (await res.json()) as { data?: { id?: string; name?: string }[]; models?: { id?: string; name?: string }[] }
    const items = (j.data ?? j.models ?? []).map((m) => String(m.id ?? m.name))
    const filtered = this.deps.cfg.preset === 'openai' ? items.filter((id) => !NON_CHAT.test(id)) : items
    const models: ModelInfo[] = filtered.sort().map((id) => ({ id, vision: null }))
    if (this.deps.cfg.preset === 'ollama') await this.fillOllamaVision(models, signal)
    return models
  }

  private async fillOllamaVision(models: ModelInfo[], signal?: AbortSignal): Promise<void> {
    const root = this.deps.cfg.baseUrl.replace(/\/v1\/?$/, '')
    await Promise.all(
      models.map(async (m) => {
        try {
          const r = await this.deps.fetch(joinUrl(root, 'api/show'), {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ model: m.id }),
            signal
          })
          if (!r.ok) return
          const j = (await r.json()) as { capabilities?: string[] }
          if (Array.isArray(j.capabilities)) m.vision = j.capabilities.includes('vision')
        } catch {
          // capability stays unknown
        }
      })
    )
  }

  async *stream(req: ChatRequest, signal: AbortSignal): AsyncIterable<StreamChunk> {
    const res = await this.post(req, signal)
    for await (const ev of readSse(res.body!, signal)) {
      if (ev.data === '[DONE]') break
      let j: {
        choices?: { delta?: { content?: string | null } }[]
        usage?: { prompt_tokens?: number; completion_tokens?: number } | null
        error?: { message?: string }
      }
      try {
        j = JSON.parse(ev.data)
      } catch {
        continue
      }
      if (j.error) throw fromHttp(500, ev.data)
      const text = j.choices?.[0]?.delta?.content
      if (text) yield { type: 'text', text }
      if (j.usage && (j.usage.prompt_tokens != null || j.usage.completion_tokens != null)) {
        yield { type: 'usage', inputTokens: j.usage.prompt_tokens ?? 0, outputTokens: j.usage.completion_tokens ?? 0 }
      }
    }
  }

  /** Some models/servers reject optional fields (temperature on reasoning models, stream_options on old servers), so I drop and retry once per field. */
  private async post(req: ChatRequest, signal: AbortSignal): Promise<Response> {
    for (let attempt = 0; attempt <= OPTIONAL_PARAMS.length; attempt++) {
      const body = this.body(req)
      const res = await this.deps.fetch(joinUrl(this.deps.cfg.baseUrl, 'chat/completions'), {
        method: 'POST',
        headers: this.headers(),
        body: JSON.stringify(body),
        signal
      })
      if (res.ok && res.body) return res
      const err = fromHttp(res.status, await res.text(), res.headers)
      const culprit = OPTIONAL_PARAMS.find((p) => p in body && rejectsParam(err.appError, p))
      if (!culprit) throw err
      this.dropped.add(culprit)
    }
    throw new ProviderError({ code: 'bad_request', message: 'Провайдер отклонил запрос' })
  }

  private body(req: ChatRequest): Record<string, unknown> {
    const isOpenAi = this.deps.cfg.preset === 'openai'
    const b: Record<string, unknown> = {
      model: req.model,
      stream: true,
      messages: req.messages.map(toOpenAiMessage)
    }
    // OpenAI reasoning models only accept max_completion_tokens and the default temperature.
    b[isOpenAi ? 'max_completion_tokens' : 'max_tokens'] = req.maxTokens
    if (!isOpenAi) b.temperature = req.temperature
    if (isOpenAi || this.deps.cfg.preset === 'anymodel') b.stream_options = { include_usage: true }
    for (const p of this.dropped) delete b[p]
    return b
  }
}

function toOpenAiMessage(m: ChatMessage): unknown {
  if (!m.images?.length) return { role: m.role, content: m.content }
  return {
    role: m.role,
    content: [{ type: 'text', text: m.content }, ...m.images.map((img) => ({ type: 'image_url', image_url: { url: `data:${img.mime};base64,${img.base64}` } }))]
  }
}
