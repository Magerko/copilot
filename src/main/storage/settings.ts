import { existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import type { DeepPartial, ProviderConfig, Settings } from '@shared/types'

export const DEFAULT_SETTINGS: Settings = {
  onboarded: false,
  uiLang: 'ru',
  answerLang: 'auto',
  offline: false,
  autoAnswer: false,
  asr: { backend: 'cpu', model: 'base', language: 'ru', vocabulary: ['PostgreSQL', 'FastAPI', 'Kubernetes', 'Docker', 'React', 'TypeScript'], threads: 6 },
  audio: { micDeviceId: null, captureMic: true, captureSystem: true },
  contextWindowMin: 3,
  overlay: {
    bounds: null,
    displayId: null,
    size: { width: 640, height: 440 },
    opacity: 0.94,
    fontScale: 1,
    expanded: false,
    theme: 'dark',
    protect: true,
    pinned: true
  },
  shortcuts: {
    toggleOverlay: 'Control+Alt+H',
    toggleListen: 'Control+Alt+L',
    answerNow: 'Control+Alt+Enter',
    snapRegion: 'Control+Alt+S',
    scrollUp: 'Control+Alt+Up',
    scrollDown: 'Control+Alt+Down',
    expand: 'Control+Alt+E',
    panic: 'Control+Alt+Backspace'
  },
  history: true,
  budget: { perSessionUsd: null, perDayUsd: null, requestsPerMinute: 20, maxConcurrent: 2 },
  pricing: {},
  roles: {},
  activeProfileId: 'default',
  consent: { mic: false, system: false, screen: false, cloud: false, history: false, participants: false, acceptedAt: null },
  window: { minimizeToTray: true, protectFromCapture: true, panicQuits: false, hideFromDock: true }
}

export function deepMerge<T>(base: T, patch: DeepPartial<T> | undefined): T {
  if (!patch || typeof patch !== 'object' || Array.isArray(patch)) return (patch ?? base) as T
  const out: Record<string, unknown> = { ...(base as Record<string, unknown>) }
  for (const [k, v] of Object.entries(patch)) {
    const cur = out[k]
    out[k] =
      v && typeof v === 'object' && !Array.isArray(v) && cur && typeof cur === 'object' && !Array.isArray(cur)
        ? deepMerge(cur, v as DeepPartial<typeof cur>)
        : v
  }
  return out as T
}

function readJson<T>(path: string): T | null {
  if (!existsSync(path)) return null
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as T
  } catch {
    return null
  }
}

function writeJson(path: string, value: unknown): void {
  const tmp = path + '.tmp'
  writeFileSync(tmp, JSON.stringify(value, null, 2))
  renameSync(tmp, path)
}

export class SettingsStore {
  private current: Settings
  private providerList: ProviderConfig[]

  constructor(
    private settingsPath: string,
    private providersPath: string
  ) {
    this.current = deepMerge(DEFAULT_SETTINGS, readJson<DeepPartial<Settings>>(settingsPath) ?? undefined)
    this.providerList = readJson<ProviderConfig[]>(providersPath) ?? []
  }

  get(): Settings {
    return this.current
  }

  patch(p: DeepPartial<Settings>): Settings {
    this.current = deepMerge(this.current, p)
    writeJson(this.settingsPath, this.current)
    return this.current
  }

  providers(): ProviderConfig[] {
    return this.providerList
  }

  saveProviders(list: ProviderConfig[]): void {
    this.providerList = list
    writeJson(this.providersPath, list)
  }
}
