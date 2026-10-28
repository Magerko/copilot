import type { AppError } from '@shared/types'

export class ProviderError extends Error {
  constructor(readonly appError: AppError) {
    super(appError.message)
  }
}

export function isLoopbackUrl(raw: string): boolean {
  try {
    const host = new URL(raw).hostname
    return host === 'localhost' || host === '[::1]' || host === '::1' || /^127\.\d+\.\d+\.\d+$/.test(host)
  } catch {
    return false
  }
}

export interface UrlCheck {
  ok: boolean
  warning?: string
  error?: string
}

/** I allow HTTP outside loopback with a warning: LAN vLLM/LiteLLM setups are a real use case. */
export function checkEndpoint(raw: string): UrlCheck {
  let u: URL
  try {
    u = new URL(raw)
  } catch {
    return { ok: false, error: 'Некорректный адрес' }
  }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return { ok: false, error: `Схема ${u.protocol} запрещена` }
  if (u.username || u.password) return { ok: false, error: 'Логин и пароль в адресе запрещены — используйте поле ключа' }
  if (u.protocol === 'http:' && !isLoopbackUrl(raw)) {
    return { ok: true, warning: 'Незащищённый HTTP вне localhost: ключ и данные идут открытым текстом' }
  }
  return { ok: true }
}

export type BlockedListener = (url: string, reason: string) => void

/** Single choke point for every outgoing request of the main process. */
export class NetGuard {
  private offline = false
  private listeners: BlockedListener[] = []

  setOffline(v: boolean): void {
    this.offline = v
  }
  isOffline(): boolean {
    return this.offline
  }
  onBlocked(l: BlockedListener): void {
    this.listeners.push(l)
  }

  assertAllowed(url: string): void {
    const check = checkEndpoint(url)
    if (!check.ok) this.block(url, check.error ?? 'bad_url', 'bad_request')
    if (this.offline && !isLoopbackUrl(url)) this.block(url, 'offline', 'offline_blocked')
  }

  readonly fetch = async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    this.assertAllowed(url)
    if (init?.redirect === 'manual' || init?.redirect === 'error') return globalThis.fetch(input, init)
    // I follow redirects here, hop by hop, so a loopback endpoint cannot bounce an offline request to the internet.
    let current = url
    let opts: RequestInit = { ...init, redirect: 'manual' }
    for (let hop = 0; hop < 5; hop++) {
      const res = await globalThis.fetch(hop === 0 ? input : current, opts)
      const loc = res.status >= 300 && res.status < 400 ? res.headers.get('location') : null
      if (!loc) return res
      current = new URL(loc, current).href
      this.assertAllowed(current)
      if (res.status === 303 || ((res.status === 301 || res.status === 302) && (opts.method ?? 'GET').toUpperCase() === 'POST')) {
        opts = { ...opts, method: 'GET', body: undefined }
      }
    }
    this.block(current, 'too_many_redirects', 'network')
  }

  private block(url: string, reason: string, code: AppError['code']): never {
    const safeUrl = url.split('?')[0]
    for (const l of this.listeners) l(safeUrl, reason)
    throw new ProviderError({
      code,
      message: code === 'offline_blocked' ? 'Заблокировано офлайн-режимом' : 'Адрес запрещён политикой приложения',
      detail: safeUrl
    })
  }
}
