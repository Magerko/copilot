import type {
  AnswerKind,
  AppSnapshot,
  AsrStatus,
  DeepPartial,
  DiagReport,
  KnowledgeDoc,
  ModelInfo,
  OutgoingPreview,
  Profile,
  ProviderConfig,
  ProviderPreset,
  ResumableSession,
  ScreenTask,
  SessionSummary,
  Settings
} from '@shared/types'

interface Bridge {
  platform: string
  invoke<T>(channel: string, ...args: unknown[]): Promise<T>
  onSnapshot(cb: (s: AppSnapshot) => void): () => void
  onSettings(cb: (s: Settings) => void): () => void
  onAsr(cb: (s: AsrStatus) => void): () => void
  onCapture(cb: (m: CaptureMsg) => void): () => void
  onScroll(cb: (dir: number) => void): () => void
  onPickerInit(cb: (m: PickerInit) => void): () => void
  sendAudio(m: unknown): void
  sendLevel(m: unknown): void
  sendAudioStatus(m: unknown): void
}

export type CaptureMsg = { action: 'start'; sessionId: string; startedAt: number } | { action: 'stop' | 'pause' | 'resume' }
export interface PickerInit {
  dataUrl: string
  scale: number
  hasVision: boolean
  ocr: boolean
}

export interface PresetInfo {
  label: string
  protocol: string
  baseUrl: string
  needsKey: boolean
  keyUrl?: string
  note: string
}

export interface InitialState {
  snapshot: AppSnapshot
  settings: Settings
  interrupted: number
  presets: Record<ProviderPreset, PresetInfo>
  asr: AsrStatus
  preview: OutgoingPreview
  resumable: ResumableSession | null
  version: string
}

export type MediaAccess = 'granted' | 'denied' | 'restricted' | 'not-determined' | 'unknown'
export interface MediaAccessReport {
  gated: boolean
  microphone: MediaAccess
  screen: MediaAccess
}

export interface ProviderTestReport {
  models: { ok: true; latencyMs: number; models: number } | { ok: false; error: { code: string; message: string; detail?: string } }
  text: { ok: boolean; ms: number | null; sample?: string; error?: string } | null
  vision: { ok: boolean; error?: string } | null
}

export const km = (window as unknown as { km: Bridge }).km
const call = km.invoke
export const isMac = km.platform === 'darwin'

export const api = {
  state: () => call<InitialState>('km:getState'),
  patchSettings: (p: DeepPartial<Settings>) => call<Settings>('km:settings:patch', p),
  providers: {
    list: () => call<ProviderConfig[]>('km:providers:list'),
    upsert: (cfg: ProviderConfig, apiKey?: string | null) => call<{ provider: ProviderConfig; warning: string | null }>('km:providers:upsert', cfg, apiKey),
    remove: (id: string) => call<void>('km:providers:remove', id),
    models: (id: string, refresh = false) => call<ModelInfo[]>('km:providers:models', id, refresh),
    test: (id: string, model: string | null) => call<ProviderTestReport>('km:providers:test', id, model)
  },
  session: {
    start: (mode: 'practice' | 'live' | 'meeting') => call<string>('km:session:start', mode),
    resume: () => call<string | null>('km:session:resume'),
    stop: () => call<void>('km:session:stop'),
    toggleListen: () => call<void>('km:session:toggleListen'),
    answerNow: (kind?: AnswerKind) => call<void>('km:session:answerNow', kind),
    askTyped: (text: string) => call<void>('km:session:askTyped', text),
    confirm: (id: string) => call<void>('km:session:confirm', id),
    dismiss: (id: string) => call<void>('km:session:dismiss', id),
    edit: (text: string) => call<void>('km:session:edit', text),
    next: () => call<void>('km:session:next'),
    panic: () => call<void>('km:session:panic')
  },
  approveBudget: () => call<void>('km:budget:approve'),
  preview: () => call<OutgoingPreview>('km:preview'),
  overlay: {
    toggle: () => call<void>('km:overlay:toggle'),
    expand: (v: boolean) => call<void>('km:overlay:expand', v),
    fit: (h: number) => call<void>('km:overlay:fit', h)
  },
  copy: (text: string) => call<void>('km:copy', text),
  screen: {
    begin: () => call<void>('km:screen:begin'),
    submit: (png: string, task: ScreenTask, withCode: boolean, codeLang: string) => call<void>('km:screen:submit', png, task, withCode, codeLang),
    cancel: () => call<void>('km:screen:cancel')
  },
  profiles: {
    list: () => call<Profile[]>('km:profiles:list'),
    upsert: (p: Profile) => call<Profile>('km:profiles:upsert', p),
    remove: (id: string) => call<void>('km:profiles:remove', id)
  },
  knowledge: {
    list: (profileId: string) => call<KnowledgeDoc[]>('km:knowledge:list', profileId),
    import: (profileId: string, kind: KnowledgeDoc['kind']) =>
      call<{ name: string; chunks: number; chars: number } | null>('km:knowledge:import', profileId, kind),
    addText: (profileId: string, kind: KnowledgeDoc['kind'], name: string, text: string) =>
      call<{ name: string; chunks: number }>('km:knowledge:addText', profileId, kind, name, text),
    remove: (id: string) => call<void>('km:knowledge:remove', id)
  },
  history: {
    list: (q?: string) => call<SessionSummary[]>('km:history:list', q),
    get: (id: string) =>
      call<{ session: Record<string, unknown>; segments: Record<string, unknown>[]; questions: Record<string, unknown>[]; answers: Record<string, unknown>[] }>(
        'km:history:get',
        id
      ),
    remove: (id: string) => call<void>('km:history:remove', id),
    removeAll: () => call<void>('km:history:removeAll'),
    export: (id: string, fmt: 'md' | 'json') => call<string | null>('km:history:export', id, fmt)
  },
  asr: {
    status: () => call<AsrStatus>('km:asr:status'),
    install: (backend: 'cpu' | 'cuda', model: string) => call<boolean>('km:asr:install', backend, model)
  },
  installOcr: () => call<void>('km:ocr:install'),
  hasNvidia: () => call<boolean>('km:gpu'),
  media: {
    access: () => call<MediaAccessReport>('km:media:access'),
    openPrivacy: (kind: 'microphone' | 'screen') => call<void>('km:media:openPrivacy', kind)
  },
  diagnostics: () => call<DiagReport>('km:diagnostics'),
  diagLog: () => call<{ at: number; kind: string; data: string }[]>('km:diagnostics:log'),
  open: (url: string) => call<void>('km:open', url)
}
