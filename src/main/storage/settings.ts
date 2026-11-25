import { existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import type { DeepPartial, ProviderConfig, Settings, ShortcutAction } from '@shared/types'

// One modifier and a digit: one hand reaches them, the system leaves them free, and a digit is the same key on any layout.
const MAC_SHORTCUTS: Partial<Record<ShortcutAction, string>> = {
  answerNow: 'Control+1',
  solveScreen: 'Control+2',
  expand: 'Control+3',
  snapRegion: 'Control+4',
  toggleAuto: 'Control+5',
  toggleOverlay: 'Control+6',
  toggleListen: 'Control+7',
  toggleDock: 'Control+8'
}

const OLD_MAC_SHORTCUTS: Partial<Record<ShortcutAction, string[]>> = {
  answerNow: ['Control+Alt+Enter', 'Control+Alt+A'],
  solveScreen: ['Control+Alt+X'],
  expand: ['Control+Alt+E'],
  snapRegion: ['Control+Alt+S'],
  toggleAuto: ['Control+Alt+Q'],
  toggleOverlay: ['Control+Alt+H'],
  toggleListen: ['Control+Alt+L']
}

/** Moves only the old defaults, so a hotkey the user chose stays. */
export function easyMacShortcuts(cur: Record<ShortcutAction, string>): Partial<Record<ShortcutAction, string>> {
  const out: Partial<Record<ShortcutAction, string>> = {}
  for (const [action, old] of Object.entries(OLD_MAC_SHORTCUTS) as [ShortcutAction, string[]][])
    if (old.includes(cur[action])) out[action] = MAC_SHORTCUTS[action]
  return out
}

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
    toggleAuto: 'Control+Alt+Q',
    snapRegion: 'Control+Alt+S',
    solveScreen: 'Control+Alt+X',
    scrollUp: 'Control+Alt+Up',
    scrollDown: 'Control+Alt+Down',
    expand: 'Control+Alt+E',
    panic: 'Control+Alt+Backspace',
    // Windows has no Dock; the taskbar button stays.
    toggleDock: '',
    ...(process.platform === 'darwin' ? MAC_SHORTCUTS : {})
  },
  codeLang: 'Python',
  history: true,
  budget: { perSessionUsd: null, perDayUsd: null, requestsPerMinute: 20, maxConcurrent: 2 },
  pricing: {},
  roles: {},
  activeProfileId: 'default',
  consent: { mic: false, system: false, screen: false, cloud: false, history: false, participants: false, acceptedAt: null },
  window: { minimizeToTray: true, collapseOnSession: true, protectFromCapture: true, panicQuits: false, hideDock: false }
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
