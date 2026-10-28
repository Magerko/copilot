import type { AppError, ChatRequest, ModelInfo, ProviderConfig, StreamChunk } from '@shared/types'

export type FetchFn = (input: string | URL | Request, init?: RequestInit) => Promise<Response>

export interface AdapterDeps {
  cfg: ProviderConfig
  apiKey: string | null
  fetch: FetchFn
}

export interface ProviderAdapter {
  listModels(signal?: AbortSignal): Promise<ModelInfo[]>
  /** Throws ProviderError. Does not retry — RequestRunner owns retries so that they never happen after the first token. */
  stream(req: ChatRequest, signal: AbortSignal): AsyncIterable<StreamChunk>
}

export type TestResult = { ok: true; latencyMs: number; models: number } | { ok: false; error: AppError }

export function joinUrl(base: string, path: string): string {
  return base.replace(/\/+$/, '') + '/' + path.replace(/^\/+/, '')
}
