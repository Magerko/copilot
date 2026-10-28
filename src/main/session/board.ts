import type { AnswerEvent, AnswerKind } from '@shared/types'

/**
 * The only path by which answers reach the UI snapshot. An answer for any (questionId, revision)
 * other than the active one — or from a request that no longer owns its slot — is rejected here,
 * so a late stream can never replace the current answer.
 */
export class AnswerBoard {
  private key: string | null = null
  private owners: Partial<Record<AnswerKind, string>> = {}
  private items: Partial<Record<AnswerKind, AnswerEvent>> = {}

  setActive(questionId: string | null, revision = 0): void {
    const next = questionId ? `${questionId}#${revision}` : null
    if (next === this.key) return
    this.key = next
    this.items = {}
    this.owners = {}
  }

  isActive(questionId: string, revision: number): boolean {
    return this.key === `${questionId}#${revision}`
  }

  /** Reserves the slot for a new request; any previous owner's events are dropped from now on. */
  claim(kind: AnswerKind, answerId: string): void {
    this.owners[kind] = answerId
  }

  apply(ev: AnswerEvent): boolean {
    if (!this.isActive(ev.questionId, ev.revision) || this.owners[ev.kind] !== ev.answerId) return false
    this.items = { ...this.items, [ev.kind]: ev }
    return true
  }

  get answers(): Partial<Record<AnswerKind, AnswerEvent>> {
    return this.items
  }
}
