import type { BudgetLimits, ModelPrice } from '@shared/types'

export type BudgetDecision = { ok: true } | { ok: false; reason: string }

export interface BudgetDeps {
  now: () => number
  /** Spend already recorded today before this process started (from usage_events). */
  spentTodayBefore: () => number
}

/**
 * I apply money limits only to paid (non-loopback) providers with a known price.
 * With an unknown price, cost stays null and the UI warns that $-limits cannot be enforced for that model.
 */
export class BudgetManager {
  private sessionUsd = 0
  private dayUsd = 0
  private unknownPriced = 0
  private requests = 0
  private recent: number[] = []
  private inflight = 0
  private overrideSession = false
  private overrideDay = false
  private day: string

  constructor(
    private limits: BudgetLimits,
    private pricing: Record<string, ModelPrice>,
    private deps: BudgetDeps
  ) {
    this.dayUsd = deps.spentTodayBefore()
    this.day = dayKey(deps.now())
  }

  // The app may stay open across midnight, so I restart the daily limit from zero.
  private rollover(): void {
    const d = dayKey(this.deps.now())
    if (d === this.day) return
    this.day = d
    this.dayUsd = 0
    this.overrideDay = false
  }

  update(limits: BudgetLimits, pricing: Record<string, ModelPrice>): void {
    this.limits = limits
    this.pricing = pricing
  }

  resetSession(): void {
    this.sessionUsd = 0
    this.unknownPriced = 0
    this.requests = 0
    this.overrideSession = false
  }

  priceOf(providerId: string, model: string): ModelPrice | null {
    return this.pricing[`${providerId}/${model}`] ?? null
  }

  canStart(isLocal: boolean): BudgetDecision {
    this.rollover()
    const now = this.deps.now()
    this.recent = this.recent.filter((t) => now - t < 60_000)
    if (this.inflight >= this.limits.maxConcurrent) return { ok: false, reason: 'concurrency' }
    if (this.recent.length >= this.limits.requestsPerMinute) return { ok: false, reason: 'rate' }
    if (isLocal) return { ok: true }
    const { perSessionUsd, perDayUsd } = this.limits
    if (perSessionUsd != null && !this.overrideSession && this.sessionUsd >= perSessionUsd) {
      return { ok: false, reason: `Достигнут лимит $${perSessionUsd} на сессию` }
    }
    if (perDayUsd != null && !this.overrideDay && this.dayUsd >= perDayUsd) {
      return { ok: false, reason: `Достигнут лимит $${perDayUsd} в день` }
    }
    return { ok: true }
  }

  begin(): void {
    this.inflight++
    this.requests++
    this.recent.push(this.deps.now())
  }

  /** Returns cost in USD, or null when the price is unknown. */
  end(providerId: string, model: string, isLocal: boolean, usage: { inputTokens: number; outputTokens: number } | null): number | null {
    this.inflight = Math.max(0, this.inflight - 1)
    if (!usage) return null
    if (isLocal) return 0
    const price = this.priceOf(providerId, model)
    if (!price) {
      this.unknownPriced++
      return null
    }
    this.rollover()
    const cost = (usage.inputTokens * price.inputPerMTok + usage.outputTokens * price.outputPerMTok) / 1_000_000
    this.sessionUsd += cost
    this.dayUsd += cost
    return cost
  }

  approveOverride(): void {
    if (this.limits.perSessionUsd != null && this.sessionUsd >= this.limits.perSessionUsd) this.overrideSession = true
    if (this.limits.perDayUsd != null && this.dayUsd >= this.limits.perDayUsd) this.overrideDay = true
  }

  snapshot(): { usd: number | null; unknownPriced: number; requests: number } {
    return { usd: this.requests === 0 ? 0 : this.sessionUsd, unknownPriced: this.unknownPriced, requests: this.requests }
  }
}

function dayKey(ms: number): string {
  const d = new Date(ms)
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
}
