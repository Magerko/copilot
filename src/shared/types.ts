export type Source = 'user' | 'remote'
export type Lang = 'ru' | 'uk' | 'en'
export type UiLang = Lang

export interface TranscriptSegment {
  sessionId: string
  segmentId: string
  source: Source
  startMs: number
  endMs: number
  text: string
  isFinal: boolean
  lang: string | null
}

export type UtteranceKind = 'question' | 'follow_up' | 'statement' | 'small_talk' | 'coding_task' | 'screen_reference' | 'unknown'

export type ConvState =
  | 'idle'
  | 'listening'
  | 'partial_transcript'
  | 'question_candidate'
  | 'question_confirmed'
  | 'generating'
  | 'answer_ready'
  | 'superseded'
  | 'paused'
  | 'stopped'
  | 'error'

export type QuestionTrigger = 'auto' | 'manual' | 'hotkey' | 'typed'
export type QuestionStatus = 'candidate' | 'confirmed' | 'superseded' | 'answered' | 'dismissed'

export interface QuestionEvent {
  sessionId: string
  questionId: string
  revision: number
  source: Source
  text: string
  startMs: number
  endMs: number
  kind: UtteranceKind
  status: QuestionStatus
  supersedes: string | null
  trigger: QuestionTrigger
}

export type AnswerKind = 'say' | 'points' | 'deep' | 'screen'
/**
 * context — find the question in the last minutes of the conversation and answer it with the capture;
 * custom — do what the user typed; solve — solve what the capture shows, without conversation or CV.
 */
export type ScreenTask = 'context' | 'custom' | 'solve' | 'explain' | 'approach' | 'review'
export type AnswerStatus = 'streaming' | 'done' | 'cancelled' | 'error' | 'stale' | 'blocked'

export interface Usage {
  inputTokens: number
  outputTokens: number
  exact: boolean
}

export interface AnswerEvent {
  sessionId: string
  questionId: string
  revision: number
  answerId: string
  kind: AnswerKind
  provider: string
  model: string
  promptPreset: string
  text: string
  status: AnswerStatus
  firstTokenMs: number | null
  latencyMs: number | null
  usage: Usage | null
  usageCostUsd: number | null
  error: AppError | null
}

export type ErrorCode =
  | 'auth'
  | 'quota'
  | 'rate_limit'
  | 'server'
  | 'timeout'
  | 'network'
  | 'offline_blocked'
  | 'budget_blocked'
  | 'bad_request'
  | 'not_found'
  | 'cancelled'
  | 'unsupported'
  | 'asr_unavailable'
  | 'device_unavailable'
  | 'unknown'

export interface AppError {
  code: ErrorCode
  message: string
  detail?: string
  status?: number
  /** From a Retry-After header, already clamped by the runner. */
  retryAfterMs?: number
}

export type ProviderProtocol = 'openai' | 'anthropic' | 'gemini'
export type ProviderPreset = 'openai' | 'anthropic' | 'gemini' | 'anymodel' | 'ollama' | 'lmstudio' | 'custom'

export interface ProviderConfig {
  id: string
  label: string
  preset: ProviderPreset
  protocol: ProviderProtocol
  baseUrl: string
  hasKey: boolean
  allowFallback: boolean
  timeoutMs: number
}

export type ModelRole = 'quick_answer' | 'deep_answer' | 'vision' | 'classification' | 'post_session_summary'
export interface RoleTarget {
  providerId: string
  model: string
}
export type RoleMap = Partial<Record<ModelRole, RoleTarget | null>>

export interface ModelInfo {
  id: string
  label?: string
  vision: boolean | null
}

export interface ChatImage {
  mime: string
  base64: string
}
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
  images?: ChatImage[]
}
export interface ChatRequest {
  model: string
  messages: ChatMessage[]
  maxTokens: number
  temperature: number
}
export type StreamChunk = { type: 'text'; text: string } | { type: 'usage'; inputTokens: number; outputTokens: number }

export interface BudgetLimits {
  perSessionUsd: number | null
  perDayUsd: number | null
  requestsPerMinute: number
  maxConcurrent: number
}
export interface ModelPrice {
  inputPerMTok: number
  outputPerMTok: number
}

export type ProfilePreset = 'hr' | 'backend' | 'frontend' | 'devops' | 'qa' | 'system_design' | 'coding' | 'meeting'
export type AnswerStyle = 'short' | 'natural' | 'academic' | 'english_b2'

export interface Profile {
  id: string
  name: string
  preset: ProfilePreset
  style: AnswerStyle
  notes: string
}

export interface KnowledgeDoc {
  id: string
  profileId: string
  name: string
  kind: 'cv' | 'jd' | 'notes'
  chunks: number
  createdAt: number
}

export type ShortcutAction = 'toggleOverlay' | 'toggleListen' | 'answerNow' | 'snapRegion' | 'scrollUp' | 'scrollDown' | 'expand' | 'askTyped' | 'panic'

export interface OverlaySettings {
  bounds: { x: number; y: number; width: number; height: number } | null
  displayId: number | null
  /** Width, and the height cap: compact mode grows with the answer up to it, expanded mode uses it as is. */
  size: { width: number; height: number }
  opacity: number
  fontScale: number
  expanded: boolean
  theme: 'dark' | 'light'
  protect: boolean
  pinned: boolean
}

export interface Consent {
  mic: boolean
  system: boolean
  screen: boolean
  cloud: boolean
  history: boolean
  participants: boolean
  acceptedAt: number | null
}

export interface Settings {
  onboarded: boolean
  uiLang: UiLang
  answerLang: 'auto' | Lang
  offline: boolean
  autoAnswer: boolean
  /** The user's own instructions on how answers should sound; added to every answer prompt. */
  answerInstructions: string
  /** text — a ready sentence to say plus talking points; cues — 3–5 short cues to answer in your own words. */
  answerFormat: 'text' | 'cues'
  asr: { backend: 'cpu' | 'cuda'; model: string; language: 'auto' | Lang; vocabulary: string[]; threads: number }
  audio: { micDeviceId: string | null; captureMic: boolean; captureSystem: boolean }
  contextWindowMin: number
  overlay: OverlaySettings
  shortcuts: Record<ShortcutAction, string>
  history: boolean
  budget: BudgetLimits
  pricing: Record<string, ModelPrice>
  roles: RoleMap
  activeProfileId: string
  consent: Consent
  window: WindowSettings
}

export interface WindowSettings {
  /** Close/minimize hides the main window to the tray instead of quitting; the session keeps running. */
  minimizeToTray: boolean
  /** Apply WDA_EXCLUDEFROMCAPTURE to the main window and region picker too, so a shared screen does not reveal them. */
  protectFromCapture: boolean
  /** Emergency stop fully quits the app (process gone) instead of only stopping capture and hiding the overlay. */
  panicQuits: boolean
  /** macOS: run as an accessory app — no Dock icon and not in ⌘Tab; the menu bar icon stays. */
  hideFromDock: boolean
}

export type DeepPartial<T> = { [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K] }

export type ComponentState = 'ok' | 'off' | 'warn' | 'error' | 'busy'
export interface ComponentStatus {
  state: ComponentState
  label: string
}

export interface ActiveQuestion {
  questionId: string
  revision: number
  text: string
  source: Source
  kind: UtteranceKind
  trigger: QuestionTrigger
}

export interface Candidate {
  questionId: string
  text: string
  kind: UtteranceKind
  reason: string
}

export interface SessionCost {
  usd: number | null
  unknownPriced: number
  requests: number
}

export interface AppSnapshot {
  sessionId: string | null
  startedAt: number | null
  state: ConvState
  listening: boolean
  activeQuestion: ActiveQuestion | null
  candidates: Candidate[]
  answers: Partial<Record<AnswerKind, AnswerEvent>>
  recentQuestions: { questionId: string; text: string }[]
  partial: Partial<Record<Source, string>>
  segments: TranscriptSegment[]
  status: Record<'mic' | 'system' | 'asr' | 'llm' | 'vision' | 'overlay' | 'protection' | 'network', ComponentStatus>
  cost: SessionCost
  budgetBlocked: string | null
  levels: Record<Source, number>
  notice: string | null
}

export interface DiagCheck {
  id: string
  label: string
  ok: boolean | null
  detail: string
}
export interface DiagReport {
  at: number
  checks: DiagCheck[]
}

export interface SessionSummary {
  id: string
  startedAt: number
  endedAt: number | null
  status: 'active' | 'ended' | 'interrupted'
  title: string
  questions: number
}

export interface ResumableSession {
  id: string
  title: string
  startedAt: number
  endedAt: number | null
  mode: 'practice' | 'live' | 'meeting'
  interrupted: boolean
  segments: number
}

export interface AsrStatus {
  binary: boolean
  model: string
  modelPresent: boolean
  running: boolean
  lastLatencyMs: number | null
  download: { name: string; received: number; total: number } | null
  error: string | null
}

export interface SessionStartOptions {
  mode: 'practice' | 'live' | 'meeting'
}

export interface OutgoingPreview {
  recipients: { label: string; baseUrl: string; local: boolean }[]
  items: string[]
}
