import type { ModelInfo, ModelRole, ProviderConfig, Settings } from '@shared/types'
import { isLoopbackUrl, type NetGuard } from '../net/guard'
import type { SecretStore } from '../storage/secrets'
import type { SettingsStore } from '../storage/settings'
import type { ProviderAdapter, TestResult } from './adapter'
import { createAdapter } from './factory'
import { toAppError } from './errors'
import { runStream } from './runner'
import type { ResolvedTarget } from '../session/manager'
import { solidPng } from '../util/png'

// Ollama serves '…:cloud' / '…-cloud' models from loopback but runs them on ollama.com, so the URL alone does not make them local.
export function isLocalTarget(baseUrl: string, model: string): boolean {
  return isLoopbackUrl(baseUrl) && !/[:-]cloud$/i.test(model)
}

const MODEL_TTL_MS = 10 * 60_000
const RED_PNG = solidPng(32, [220, 20, 20]).toString('base64')

export interface ProviderTestReport {
  models: TestResult
  text: { ok: boolean; ms: number | null; sample?: string; error?: string } | null
  vision: { ok: boolean; error?: string } | null
}

export class ProviderRegistry {
  private adapters = new Map<string, ProviderAdapter>()
  private modelCache = new Map<string, { at: number; models: ModelInfo[] }>()
  readonly visionOk = new Map<string, boolean>()
  /** Last real outcome per provider/model (test or live answer): I show the LLM status green only after one succeeded. */
  readonly textOk = new Map<string, boolean>()

  constructor(
    private store: SettingsStore,
    private secrets: SecretStore,
    private guard: NetGuard
  ) {}

  list(): ProviderConfig[] {
    return this.store.providers().map((p) => ({ ...p, hasKey: this.secrets.has(`provider:${p.id}`) }))
  }

  get(id: string): ProviderConfig | undefined {
    return this.list().find((p) => p.id === id)
  }

  upsert(cfg: ProviderConfig, apiKey?: string | null): ProviderConfig {
    if (apiKey) this.secrets.set(`provider:${cfg.id}`, apiKey.trim())
    const list = this.store.providers().filter((p) => p.id !== cfg.id)
    const saved = { ...cfg, hasKey: this.secrets.has(`provider:${cfg.id}`) }
    this.store.saveProviders([...list, saved])
    this.adapters.delete(cfg.id)
    this.modelCache.delete(cfg.id)
    return saved
  }

  remove(id: string): void {
    this.secrets.delete(`provider:${id}`)
    this.store.saveProviders(this.store.providers().filter((p) => p.id !== id))
    this.adapters.delete(id)
    this.modelCache.delete(id)
    const roles = { ...this.store.get().roles }
    for (const k of Object.keys(roles) as ModelRole[]) if (roles[k]?.providerId === id) roles[k] = null
    this.store.patch({ roles })
  }

  adapter(id: string): ProviderAdapter | null {
    const cfg = this.get(id)
    if (!cfg) return null
    let a = this.adapters.get(id)
    if (!a) {
      a = createAdapter({ cfg, apiKey: this.secrets.get(`provider:${id}`), fetch: this.guard.fetch })
      this.adapters.set(id, a)
    }
    return a
  }

  async models(id: string, refresh = false): Promise<ModelInfo[]> {
    const c = this.modelCache.get(id)
    if (c && !refresh && Date.now() - c.at < MODEL_TTL_MS) return c.models
    const a = this.adapter(id)
    if (!a) return []
    const models = await a.listModels(AbortSignal.timeout(15_000))
    this.modelCache.set(id, { at: Date.now(), models })
    return models
  }

  resolve(role: ModelRole, settings: Settings): ResolvedTarget | null {
    const t = settings.roles[role]
    if (!t?.model) return null
    const cfg = this.get(t.providerId)
    const adapter = cfg && this.adapter(cfg.id)
    if (!cfg || !adapter) return null
    return { cfg, model: t.model, adapter, isLocal: isLocalTarget(cfg.baseUrl, t.model) }
  }

  /** I use only providers the user explicitly marked as allowed fallbacks (FR-P05). */
  fallback(role: ModelRole, exclude: string, settings: Settings): ResolvedTarget | null {
    for (const r of [role, 'quick_answer', 'deep_answer'] as ModelRole[]) {
      const t = settings.roles[r]
      if (!t || t.providerId === exclude) continue
      const cfg = this.get(t.providerId)
      if (cfg?.allowFallback) {
        const adapter = this.adapter(cfg.id)
        if (adapter) return { cfg, model: t.model, adapter, isLocal: isLocalTarget(cfg.baseUrl, t.model) }
      }
    }
    return null
  }

  async test(id: string, model: string | null): Promise<ProviderTestReport> {
    const a = this.adapter(id)
    const cfg = this.get(id)
    if (!a || !cfg) return { models: { ok: false, error: { code: 'not_found', message: 'Провайдер не найден' } }, text: null, vision: null }
    const t0 = Date.now()
    let models: TestResult
    let list: ModelInfo[]
    try {
      list = await this.models(id, true)
      models = { ok: true, latencyMs: Date.now() - t0, models: list.length }
    } catch (e) {
      return { models: { ok: false, error: toAppError(e) }, text: null, vision: null }
    }
    if (!model) return { models, text: null, vision: null }
    // Cold-loading a local model into VRAM routinely takes 20–60 s on the first request.
    const budget = isLoopbackUrl(cfg.baseUrl) ? 120_000 : 30_000
    let text: ProviderTestReport['text']
    try {
      const r = await runStream(
        a,
        { model, messages: [{ role: 'user', content: 'Reply with exactly: OK' }], maxTokens: 64, temperature: 0 },
        AbortSignal.timeout(budget),
        { onText: () => {} },
        { timeoutMs: Math.max(cfg.timeoutMs, 20_000), retries: 1 }
      )
      text = { ok: r.text.length > 0, ms: r.firstTokenMs, sample: r.text.slice(0, 60) }
    } catch (e) {
      text = { ok: false, ms: null, error: toAppError(e).message + (toAppError(e).detail ? `: ${toAppError(e).detail}` : '') }
    }
    this.textOk.set(`${id}/${model}`, text.ok)
    let vision: ProviderTestReport['vision']
    if (list.find((m) => m.id === model)?.vision === false) {
      this.visionOk.set(`${id}/${model}`, false)
      return { models, text, vision: { ok: false, error: 'Модель без поддержки изображений — для экрана будет OCR' } }
    }
    try {
      const r = await runStream(
        a,
        {
          model,
          messages: [{ role: 'user', content: 'What is the main color of this image? One word.', images: [{ mime: 'image/png', base64: RED_PNG }] }],
          maxTokens: 64,
          temperature: 0
        },
        AbortSignal.timeout(budget),
        { onText: () => {} },
        { timeoutMs: Math.max(cfg.timeoutMs, 20_000), retries: 0 }
      )
      const ok = /red|красн|червон/i.test(r.text)
      vision = ok ? { ok } : { ok, error: `Модель не распознала тестовое изображение («${r.text.slice(0, 40)}»)` }
    } catch (e) {
      vision = { ok: false, error: toAppError(e).message }
    }
    this.visionOk.set(`${id}/${model}`, vision.ok)
    return { models, text, vision }
  }
}
