import type { AppError, ErrorCode } from '@shared/types'
import { ProviderError } from '../net/guard'
import { redact } from '../storage/redact'
import { t } from '@shared/i18n'

export { ProviderError }

const MESSAGES: Record<ErrorCode, string> = {
  auth: 'Проверьте API-ключ',
  quota: 'Закончился баланс или лимит у провайдера',
  rate_limit: 'Слишком много запросов — провайдер просит подождать',
  server: 'Сбой на стороне провайдера',
  timeout: 'Провайдер не ответил вовремя',
  network: 'Сеть недоступна',
  offline_blocked: 'Заблокировано офлайн-режимом',
  budget_blocked: 'Достигнут лимит бюджета',
  bad_request: 'Провайдер отклонил запрос',
  not_found: 'Модель или адрес не найдены',
  cancelled: 'Отменено',
  unsupported: 'Функция не поддерживается моделью',
  asr_unavailable: 'Распознавание речи недоступно',
  device_unavailable: 'Устройство недоступно',
  unknown: 'Неизвестная ошибка'
}

export function appError(code: ErrorCode, detail?: string, status?: number): AppError {
  // Providers echo the rejected key in 401 bodies; detail reaches the UI and the screen may be shared, so I redact it.
  return { code, message: t(MESSAGES[code]), detail: detail === undefined ? undefined : redact(detail).slice(0, 400), status }
}

export function fromHttp(status: number, body: string, headers?: Headers | null): ProviderError {
  const lower = body.toLowerCase()
  let code: ErrorCode
  if (status === 401 || status === 403) code = 'auth'
  else if (status === 402 || /insufficient_quota|credit balance|billing|quota exceeded/.test(lower)) code = 'quota'
  else if (status === 429) code = 'rate_limit'
  else if (status === 404) code = 'not_found'
  else if (status === 408) code = 'timeout'
  else if (status >= 500) code = 'server'
  else if (status >= 400) code = 'bad_request'
  else code = 'unknown'
  const err = appError(code, extractMessage(body), status)
  const ra = retryAfterMs(headers?.get('retry-after') ?? null)
  return new ProviderError(ra === null ? err : { ...err, retryAfterMs: ra })
}

// Retry-After is either delta-seconds or an HTTP date (RFC 9110 §10.2.3).
function retryAfterMs(v: string | null): number | null {
  if (!v) return null
  const secs = Number(v)
  if (Number.isFinite(secs)) return Math.max(0, secs * 1000)
  const at = Date.parse(v)
  return Number.isNaN(at) ? null : Math.max(0, at - Date.now())
}

function extractMessage(body: string): string {
  try {
    const j = JSON.parse(body)
    const e = Array.isArray(j) ? j[0]?.error : j.error
    return String(e?.message ?? j.message ?? body)
  } catch {
    return body
  }
}

export function toAppError(e: unknown): AppError {
  if (e instanceof ProviderError) return e.appError
  if (e instanceof Error && (e.name === 'AbortError' || e.name === 'APIUserAbortError' || /aborted/i.test(e.message))) {
    return appError('cancelled')
  }
  if (e instanceof TypeError) {
    const cause = (e.cause as Error | undefined)?.message ?? ''
    return appError('network', `${e.message} ${cause}`.trim())
  }
  return appError('unknown', e instanceof Error ? e.message : String(e))
}

export function isRetryable(err: AppError): boolean {
  return err.code === 'rate_limit' || err.code === 'server' || err.code === 'network'
}

/** Parameter-rejection 400s I can recover from by dropping an optional field. */
export function rejectsParam(err: AppError, param: string): boolean {
  return err.code === 'bad_request' && (err.detail ?? '').toLowerCase().includes(param)
}
