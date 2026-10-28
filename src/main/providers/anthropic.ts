import Anthropic from '@anthropic-ai/sdk'
import type { ChatRequest, ModelInfo, StreamChunk } from '@shared/types'
import type { AdapterDeps, ProviderAdapter } from './adapter'
import { appError, fromHttp, ProviderError } from './errors'

// Models that accept the server-side refusal fallback (`fallbacks: "default"`).
const FALLBACK_MODELS = /^claude-(fable-5-1|opus-5-5|opus-5|sonnet-5-5)$/
// Effort is rejected by Haiku 4.5 / Sonnet 4.5 and older; those simply run without it.
const NO_EFFORT = /claude-(3|haiku-4-5|sonnet-4-5|opus-4-1|opus-4-0|sonnet-4-0)/

export class AnthropicAdapter implements ProviderAdapter {
  private client: Anthropic

  constructor(deps: AdapterDeps) {
    this.client = new Anthropic({
      apiKey: deps.apiKey ?? 'missing',
      baseURL: deps.cfg.baseUrl.replace(/\/v1\/?$/, ''),
      fetch: deps.fetch as typeof fetch,
      maxRetries: 0,
      timeout: 120_000
    })
  }

  async listModels(): Promise<ModelInfo[]> {
    try {
      const out: ModelInfo[] = []
      for await (const m of this.client.models.list({ limit: 100 })) {
        out.push({ id: m.id, label: m.display_name, vision: true })
      }
      return out
    } catch (e) {
      throw mapError(e)
    }
  }

  async *stream(req: ChatRequest, signal: AbortSignal): AsyncIterable<StreamChunk> {
    const system = req.messages
      .filter((m) => m.role === 'system')
      .map((m) => m.content)
      .join('\n\n')
    const messages: Anthropic.Beta.BetaMessageParam[] = req.messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.images?.length
          ? [
              ...m.images.map((img) => ({
                type: 'image' as const,
                source: { type: 'base64' as const, media_type: img.mime as 'image/png', data: img.base64 }
              })),
              { type: 'text' as const, text: m.content }
            ]
          : m.content
      }))
    const params: Record<string, unknown> = { model: req.model, max_tokens: req.maxTokens, system, messages }
    // Quick answers are latency-critical, so I keep thinking short with low effort on models where it can't be disabled.
    if (!NO_EFFORT.test(req.model)) params.output_config = { effort: req.maxTokens <= 400 ? 'low' : 'medium' }
    if (FALLBACK_MODELS.test(req.model)) {
      params.betas = ['server-side-fallback-2026-07-01']
      params.fallbacks = 'default'
    }
    let input = 0
    let output = 0
    try {
      const stream = this.client.beta.messages.stream(params as never, { signal })
      for await (const ev of stream) {
        if (ev.type === 'message_start') input = ev.message.usage?.input_tokens ?? 0
        else if (ev.type === 'content_block_delta' && ev.delta.type === 'text_delta') yield { type: 'text', text: ev.delta.text }
        else if (ev.type === 'message_delta') {
          output = ev.usage?.output_tokens ?? output
          if (ev.delta.stop_reason === 'refusal') {
            throw new ProviderError(appError('unsupported', 'Модель отказалась отвечать (refusal)'))
          }
        }
      }
    } catch (e) {
      throw mapError(e)
    }
    yield { type: 'usage', inputTokens: input, outputTokens: output }
  }
}

function mapError(e: unknown): unknown {
  if (e instanceof ProviderError || e instanceof Anthropic.APIUserAbortError) return e
  if (e instanceof Anthropic.APIConnectionTimeoutError) return new ProviderError(appError('timeout'))
  if (e instanceof Anthropic.APIConnectionError) {
    const cause = (e as { cause?: unknown }).cause
    if (cause instanceof ProviderError) return cause
    return new ProviderError(appError('network', e.message))
  }
  if (e instanceof Anthropic.APIError && typeof e.status === 'number') {
    return fromHttp(e.status, JSON.stringify(e.error ?? { message: e.message }), e.headers instanceof Headers ? e.headers : null)
  }
  return e
}
