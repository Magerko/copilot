import {
  app,
  BrowserWindow,
  clipboard,
  desktopCapturer,
  dialog,
  globalShortcut,
  ipcMain,
  Menu,
  nativeImage,
  safeStorage,
  screen,
  session,
  shell,
  Tray
} from 'electron'
import { randomUUID } from 'node:crypto'
import { existsSync, mkdirSync, renameSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type {
  AnswerKind,
  AppSnapshot,
  DeepPartial,
  Lang,
  ModelRole,
  OutgoingPreview,
  Profile,
  ProviderConfig,
  ScreenTask,
  Settings,
  ShortcutAction,
  Source
} from '@shared/types'
import { AsrAssets, type AsrBackend } from './asr/assets'
import { AsrManager } from './asr/manager'
import { SileroGate } from './asr/silero'
import { BudgetManager } from './budget/budget'
import { extractText } from './context/importers'
import { chunkText } from './context/retrieval'
import { runDiagnostics } from './diagnostics'
import { exportSession } from './export'
import { ensureMicrophone, mediaAccess, openPrivacyPane } from './media/permissions'
import { checkEndpoint, NetGuard } from './net/guard'
import { PRESETS } from './providers/presets'
import { ProviderRegistry } from './providers/registry'
import { runStream } from './providers/runner'
import { Ocr } from './screen/ocr'
import { SessionManager } from './session/manager'
import { Db } from './storage/db'
import { redact, redactDeep } from './storage/redact'
import { SecretStore } from './storage/secrets'
import { SettingsStore } from './storage/settings'
import { appIcon } from './util/png'
import { createDashboard, createOverlay, createPicker, displayProtectionSupported, sanitizeBounds } from './windows/windows'

app.setAppUserModelId('app.copilot')
// I keep runtime data outside OneDrive/Cyrillic paths: whisper.cpp opens model files with ANSI APIs.
// The app was renamed kairos-m → copilot; I move the old data folder once so settings and models carry over.
const dataHome = app.getPath('appData')
const newData = join(dataHome, 'copilot')
const oldData = join(dataHome, 'kairos-m')
try {
  if (!existsSync(newData) && existsSync(oldData)) renameSync(oldData, newData)
} catch {
  // a locked file aborts the move; fall back to whichever folder exists
}
app.setPath('userData', existsSync(newData) ? newData : oldData)
// I key the lock by userData, so it has to come after setPath; app.quit() alone would leave this module
// running, and a second instance would run migrations and mark the live session as interrupted.
if (!app.requestSingleInstanceLock()) process.exit(0)

const dataDir = app.getPath('userData')
mkdirSync(dataDir, { recursive: true })

const guard = new NetGuard()
const settings = new SettingsStore(join(dataDir, 'settings.json'), join(dataDir, 'providers.json'))
const db = new Db(join(dataDir, 'kairos.db'))
const interrupted = db.recoverInterrupted()
let secrets: SecretStore
let registry: ProviderRegistry
let asr: AsrManager
let assets: AsrAssets
let ocr: Ocr
let sessionMgr: SessionManager
let budget: BudgetManager

let dashboard: BrowserWindow | null = null
let overlay: BrowserWindow | null = null
let picker: BrowserWindow | null = null
let tray: Tray | null = null
let quitting = false
const shortcutConflicts: string[] = []

function log(kind: string, data: unknown): void {
  try {
    db.logDiag(kind, redactDeep(data))
  } catch {
    // I never let diagnostics break the app
  }
}

process.on('uncaughtException', (e) => log('uncaught', { message: redact(String(e?.stack ?? e)) }))
process.on('unhandledRejection', (e) => log('unhandled', { message: redact(String((e as Error)?.stack ?? e)) }))

function s(): Settings {
  return settings.get()
}

function ensureDefaultProfile(): void {
  if (!db.listProfiles().length) {
    db.upsertProfile({ id: 'default', name: 'Основной', preset: 'backend', style: 'natural', notes: '' })
  }
}

function profile(): Profile {
  const all = db.listProfiles()
  return all.find((p) => p.id === s().activeProfileId) ?? all[0]
}

// I coalesce the snapshot broadcast: streaming emits per token, the UI needs ≤ 30 fps.
let emitTimer: NodeJS.Timeout | null = null
function emit(): void {
  if (emitTimer) return
  emitTimer = setTimeout(() => {
    emitTimer = null
    const snap: AppSnapshot = sessionMgr.snap
    for (const w of [dashboard, overlay]) if (w && !w.isDestroyed()) w.webContents.send('km:snapshot', snap)
  }, 33)
}

function broadcast(channel: string, payload: unknown): void {
  for (const w of [dashboard, overlay]) if (w && !w.isDestroyed()) w.webContents.send(channel, payload)
}

function asrConfig() {
  const a = s().asr
  const language: 'auto' | Lang = a.language
  return { backend: a.backend as AsrBackend, model: a.model, language, vocabulary: a.vocabulary, threads: a.threads }
}

function updateLlmStatus(): void {
  const st = s()
  const quick = registry.resolve('quick_answer', st)
  const vision = registry.resolve('vision', st)
  const tOk = quick ? registry.textOk.get(`${quick.cfg.id}/${quick.model}`) : undefined
  sessionMgr.snap.status.llm = quick
    ? {
        state: st.offline && !quick.isLocal ? 'error' : tOk ? 'ok' : tOk === false ? 'error' : 'warn',
        label: `${quick.cfg.label} · ${quick.model}${quick.isLocal ? ' · локально' : ' · облако'}${tOk === undefined ? ' · не проверено' : tOk ? '' : ' · последний запрос с ошибкой'}`
      }
    : { state: 'warn', label: 'модель не выбрана' }
  const vOk = vision ? registry.visionOk.get(`${vision.cfg.id}/${vision.model}`) : undefined
  sessionMgr.snap.status.vision = vision
    ? {
        state: vOk === false ? 'error' : vOk ? 'ok' : 'warn',
        label: `${vision.model}${vOk ? '' : vOk === false ? ' · проверка не пройдена' : ' · не проверено'}`
      }
    : { state: ocr.installed() ? 'warn' : 'off', label: ocr.installed() ? 'только локальный OCR' : 'выкл.' }
  sessionMgr.snap.status.network = st.offline ? { state: 'warn', label: 'офлайн-режим: внешние вызовы заблокированы' } : { state: 'ok', label: 'онлайн' }
  emit()
}

function applySettings(prev: Settings | null): void {
  const st = s()
  guard.setOffline(st.offline)
  budget.update(st.budget, st.pricing)
  asr.setConfig(asrConfig())
  if (!prev || JSON.stringify(prev.shortcuts) !== JSON.stringify(st.shortcuts)) registerShortcuts()
  if (overlay && prev) {
    const o = st.overlay
    overlay.setAlwaysOnTop(o.pinned, 'screen-saver')
    if (prev.overlay.protect !== o.protect) applyProtection()
    if (prev.overlay.theme !== o.theme) overlay.setBackgroundColor(o.theme === 'dark' ? '#14161b' : '#f7f7f5')
  }
  if (!prev || prev.window.protectFromCapture !== st.window.protectFromCapture) applyWindowProtection()
  updateLlmStatus()
  broadcast('km:settings', st)
}

// Windows gives no feedback on whether a capture tool honours the flag, so I never show 'set' as a green guarantee.
function applyProtection(): void {
  const want = s().overlay.protect
  const supported = displayProtectionSupported()
  const live = !!overlay && !overlay.isDestroyed()
  if (live) overlay!.setContentProtection(want && supported)
  sessionMgr.setStatus(
    'protection',
    !want
      ? { state: 'off', label: 'выкл.' }
      : !supported
        ? { state: 'error', label: 'не поддерживается этой версией системы' }
        : live
          ? { state: 'warn', label: 'флаг установлен — работает не со всеми программами захвата, проверьте у получателя' }
          : { state: 'warn', label: 'включится при показе подсказок' }
  )
}

function ensureOverlay(): BrowserWindow {
  if (overlay && !overlay.isDestroyed()) return overlay
  overlay = createOverlay(s().overlay)
  let saveTimer: NodeJS.Timeout | null = null
  const save = () => {
    if (saveTimer) clearTimeout(saveTimer)
    saveTimer = setTimeout(() => {
      if (!overlay || overlay.isDestroyed()) return
      const b = overlay.getBounds()
      settings.patch({ overlay: { bounds: b, displayId: screen.getDisplayMatching(b).id } })
    }, 400)
  }
  overlay.on('moved', save)
  overlay.on('resized', save)
  overlay.on('closed', () => {
    overlay = null
    sessionMgr.setStatus('overlay', { state: 'off', label: 'скрыт' })
  })
  overlay.webContents.once('did-finish-load', () => {
    overlay?.webContents.send('km:settings', s())
    overlay?.webContents.send('km:snapshot', sessionMgr.snap)
  })
  applyProtection()
  return overlay
}

function showOverlay(): void {
  const w = ensureOverlay()
  w.setBounds(sanitizeBounds(w.getBounds()))
  // I show it inactive so the foreground window (IDE, Zoom) keeps keyboard focus (spike S1).
  w.showInactive()
  sessionMgr.setStatus('overlay', { state: 'ok', label: s().overlay.expanded ? 'развёрнут' : 'компактный' })
}

function toggleOverlay(): void {
  if (overlay?.isVisible()) {
    overlay.hide()
    sessionMgr.setStatus('overlay', { state: 'off', label: 'скрыт' })
  } else showOverlay()
}

function showDashboard(): void {
  if (!dashboard || dashboard.isDestroyed()) dashboard = makeDashboard()
  if (dashboard.isMinimized()) dashboard.restore()
  dashboard.show()
  dashboard.focus()
}

function makeDashboard(): BrowserWindow {
  const w = createDashboard()
  let trayHintShown = false
  const toTray = () => {
    w.hide()
    // I nudge once so the window doesn't just "vanish" the first time.
    if (!trayHintShown && tray) {
      trayHintShown = true
      tray.displayBalloon?.({ title: 'Copilot', content: 'Свёрнуто в трей. Нажмите значок, чтобы открыть.' })
    }
  }
  w.on('close', (e) => {
    // I hide to tray on close unless the user is quitting; the session (and its capture) keeps running.
    if (!quitting && (s().window.minimizeToTray || sessionMgr.active)) {
      e.preventDefault()
      toTray()
    }
  })
  // 'minimize' fires after the fact and preventDefault is unreliable, so I hide the already-minimized window instead.
  w.on('minimize', () => {
    if (!quitting && s().window.minimizeToTray) toTray()
  })
  w.on('closed', () => {
    dashboard = null
    if (!quitting) app.quit()
  })
  w.setContentProtection(s().window.protectFromCapture && displayProtectionSupported())
  return w
}

// I tie the main window and the region picker to one flag; the overlay keeps its own (overlay.protect).
function applyWindowProtection(): void {
  const want = s().window.protectFromCapture && displayProtectionSupported()
  if (dashboard && !dashboard.isDestroyed()) dashboard.setContentProtection(want)
  if (picker && !picker.isDestroyed()) picker.setContentProtection(want)
}

function afterStart(id: string, mode: 'practice' | 'live' | 'meeting'): string {
  clearTimeout(asrIdleTimer)
  asr.resetSession()
  void asr.ensure()
  warmLocalModel()
  dashboard?.webContents.send('km:capture', { action: 'start', sessionId: id, startedAt: Date.now() - sessionMgr.sessionClockMs() })
  if (mode !== 'meeting') showOverlay()
  refreshTray()
  return id
}

function startSession(mode: 'practice' | 'live' | 'meeting'): string {
  return afterStart(sessionMgr.start({ mode }), mode)
}

function resumeSession(): string | null {
  const r = db.lastResumable()
  if (!r) return null
  return afterStart(sessionMgr.continuePrevious(db.sessionSegments(r.id), r.mode), r.mode)
}

// A cold local model costs 20–60 s on its first request, so I load it while the user is still settling in.
function warmLocalModel(): void {
  const t = registry.resolve('quick_answer', s())
  if (!t?.isLocal) return
  void runStream(
    t.adapter,
    { model: t.model, messages: [{ role: 'user', content: 'OK' }], maxTokens: 1, temperature: 0 },
    AbortSignal.timeout(120_000),
    { onText: () => {} },
    { timeoutMs: 120_000, retries: 0 }
  ).catch(() => {})
}

// whisper-server holds ~300 MB; I keep it briefly for a quick restart, then give the memory back.
let asrIdleTimer: ReturnType<typeof setTimeout> | undefined
function scheduleAsrIdleStop(): void {
  clearTimeout(asrIdleTimer)
  asrIdleTimer = setTimeout(() => {
    if (!sessionMgr.active) asr.stop()
  }, 3 * 60_000)
}

function stopSession(): void {
  sessionMgr.stop()
  scheduleAsrIdleStop()
  dashboard?.webContents.send('km:capture', { action: 'stop' })
  refreshTray()
}

function toggleListen(): void {
  if (!sessionMgr.active) {
    startSession('live')
    return
  }
  if (sessionMgr.snap.listening) {
    sessionMgr.pause()
    dashboard?.webContents.send('km:capture', { action: 'pause' })
  } else {
    sessionMgr.resume()
    dashboard?.webContents.send('km:capture', { action: 'resume' })
  }
  refreshTray()
}

function panic(): void {
  sessionMgr.panic()
  asr.stop()
  dashboard?.webContents.send('km:capture', { action: 'stop' })
  overlay?.hide()
  picker?.close()
  refreshTray()
  // Opt-in: emergency stop leaves nothing running — the whole app quits after capture is down.
  if (s().window.panicQuits) {
    quitting = true
    app.quit()
  }
}

const SHORTCUT_ACTIONS: Record<ShortcutAction, () => void> = {
  toggleOverlay,
  toggleListen,
  answerNow: () => sessionMgr.answerNow('say', 'hotkey'),
  snapRegion: () => void beginRegion(),
  scrollUp: () => overlay?.webContents.send('km:scroll', -1),
  scrollDown: () => overlay?.webContents.send('km:scroll', 1),
  expand: () => {
    const expanded = !s().overlay.expanded
    settings.patch({ overlay: { expanded } })
    broadcast('km:settings', s())
    if (expanded && !sessionMgr.snap.answers.deep) sessionMgr.answerNow('deep', 'hotkey')
  },
  panic
}

/** I register OS hotkeys, not a keyboard hook, so nothing can leak if the app crashes (FR-O05). */
function registerShortcuts(): void {
  globalShortcut.unregisterAll()
  shortcutConflicts.length = 0
  for (const [action, accel] of Object.entries(s().shortcuts) as [ShortcutAction, string][]) {
    if (!accel) continue
    try {
      if (!globalShortcut.register(accel, SHORTCUT_ACTIONS[action])) shortcutConflicts.push(`${accel} (${action}) занято другой программой`)
    } catch {
      shortcutConflicts.push(`${accel} (${action}) — некорректное сочетание`)
    }
  }
  if (shortcutConflicts.length) log('shortcut_conflicts', shortcutConflicts)
}

const SCREEN_DENIED = 'Снимки экрана выключены — разрешите их в «Настройки → Приватность»'

async function beginRegion(): Promise<void> {
  if (picker) return
  if (!s().consent.screen) {
    sessionMgr.notice(SCREEN_DENIED)
    return
  }
  const cursor = screen.getCursorScreenPoint()
  const display = screen.getDisplayNearestPoint(cursor)
  const overlayWasVisible = !!overlay?.isVisible()
  const protectedOverlay = s().overlay.protect && displayProtectionSupported()
  if (overlayWasVisible && !protectedOverlay) overlay!.hide()
  try {
    const size = { width: Math.round(display.size.width * display.scaleFactor), height: Math.round(display.size.height * display.scaleFactor) }
    const sources = await desktopCapturer.getSources({ types: ['screen'], thumbnailSize: size })
    const src = sources.find((x) => x.display_id === String(display.id)) ?? sources[0]
    if (!src) throw new Error('Не удалось получить изображение экрана')
    const dataUrl = src.thumbnail.toDataURL()
    picker = createPicker(display)
    applyWindowProtection()
    picker.on('closed', () => {
      picker = null
      if (overlayWasVisible && !protectedOverlay) overlay?.showInactive()
    })
    picker.webContents.once('did-finish-load', () => {
      picker?.webContents.send('km:picker-init', { dataUrl, scale: display.scaleFactor, hasVision: !!registry.resolve('vision', s()), ocr: ocr.installed() })
      picker?.show()
      picker?.focus()
    })
  } catch (e) {
    if (overlayWasVisible && !protectedOverlay) overlay?.showInactive()
    sessionMgr.notice(e instanceof Error ? e.message : String(e))
  }
}

async function submitRegion(pngBase64: string, task: ScreenTask, withCode: boolean, codeLang: string): Promise<void> {
  picker?.close()
  if (!s().consent.screen) {
    sessionMgr.notice(SCREEN_DENIED)
    return
  }
  let img = nativeImage.createFromBuffer(Buffer.from(pngBase64, 'base64'))
  const { width } = img.getSize()
  if (width > 1600) img = img.resize({ width: 1600, quality: 'best' })
  const png = img.toPNG()
  const target = registry.resolve('vision', s())
  const visionKnownBad = target ? registry.visionOk.get(`${target.cfg.id}/${target.model}`) === false : true
  if (target && !visionKnownBad) {
    await sessionMgr.screen({ mime: 'image/png', base64: png.toString('base64') }, null, task, withCode, codeLang)
    return
  }
  try {
    sessionMgr.notice('Модель без vision — использован локальный OCR (качество зависит от чёткости текста)')
    const text = await ocr.recognize(png)
    await sessionMgr.screen(null, text || '(OCR не нашёл текста)', task, withCode, codeLang)
  } catch (e) {
    sessionMgr.notice(`Снимок не отправлен: ${e instanceof Error ? e.message : String(e)}`)
  }
}

function outgoingPreview(): OutgoingPreview {
  const st = s()
  const roles: ModelRole[] = ['quick_answer', 'deep_answer', 'vision']
  const seen = new Map<string, OutgoingPreview['recipients'][number]>()
  for (const r of roles) {
    const t = registry.resolve(r, st)
    if (t) seen.set(t.cfg.id, { label: t.cfg.label, baseUrl: t.cfg.baseUrl, local: t.isLocal })
  }
  return {
    recipients: [...seen.values()],
    items: [
      'Аудио не покидает компьютер — распознаётся локально (whisper.cpp)',
      'Провайдеру ответов уходит: текст текущего вопроса, последние минуты транскрипта, подходящие фрагменты CV/JD и заметки профиля',
      'Снимки экрана — только после вашего выделения и подтверждения',
      st.history && st.consent.history ? 'История сохраняется только на этом компьютере (SQLite)' : 'История не сохраняется'
    ]
  }
}

function refreshTray(): void {
  if (!tray) return
  const active = sessionMgr.active
  tray.setToolTip(active ? (sessionMgr.snap.listening ? 'Copilot — слушает' : 'Copilot — пауза') : 'Copilot')
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: 'Открыть Copilot', click: showDashboard },
      { label: 'Показать/скрыть подсказки', click: toggleOverlay },
      active
        ? { label: sessionMgr.snap.listening ? 'Пауза' : 'Продолжить', click: toggleListen }
        : { label: 'Начать сессию', click: () => startSession('live') },
      ...(active ? [{ label: 'Завершить сессию', click: stopSession }] : []),
      { type: 'separator' },
      { label: 'Аварийная остановка', click: panic },
      { label: 'Выход', click: () => app.quit() }
    ])
  )
}

function lockDownSessions(): void {
  const dev = process.env.ELECTRON_RENDERER_URL
  const devOrigin = dev ? new URL(dev).origin : null
  // I never let the UI touch the network: provider calls go through main → NetGuard only.
  session.defaultSession.webRequest.onBeforeRequest((details, cb) => {
    const u = details.url
    const allowed =
      u.startsWith('file:') ||
      u.startsWith('devtools:') ||
      u.startsWith('data:') ||
      u.startsWith('blob:') ||
      u.startsWith('chrome-extension:') ||
      (devOrigin !== null && (u.startsWith(devOrigin) || u.startsWith(devOrigin.replace('http', 'ws'))))
    if (!allowed) log('renderer_blocked', { url: u.split('?')[0] })
    cb({ cancel: !allowed })
  })
  session.defaultSession.setPermissionRequestHandler((_wc, permission, cb, details) => {
    if (permission === 'media') {
      const wantsMic = 'mediaTypes' in details && (details.mediaTypes ?? []).includes('audio')
      if (wantsMic) return void ensureMicrophone().then(cb)
      return cb(true)
    }
    cb(permission === 'display-capture' || permission === 'clipboard-sanitized-write')
  })
  session.defaultSession.setDisplayMediaRequestHandler(
    (_req, cb) => {
      // On macOS the first getSources() registers the app under «Screen & System Audio Recording» and shows the prompt;
      // until it is granted the call fails or returns nothing, and the renderer reports the missing permission.
      desktopCapturer
        .getSources({ types: ['screen'] })
        .then((sources) => {
          // I use only the audio loopback; the renderer stops the video track immediately.
          cb(sources[0] ? { video: sources[0], audio: 'loopback' } : {})
        })
        .catch((e: unknown) => {
          log('display_media_fail', { message: e instanceof Error ? e.message : String(e), access: mediaAccess().screen })
          cb({})
        })
    },
    { useSystemPicker: false }
  )
  app.on('web-contents-created', (_e, wc) => {
    wc.setWindowOpenHandler(({ url }) => {
      if (/^https:\/\//.test(url)) void shell.openExternal(url)
      return { action: 'deny' }
    })
    wc.on('will-navigate', (e, url) => {
      if (!devOrigin || !url.startsWith(devOrigin)) e.preventDefault()
    })
  })
}

function handle(channel: string, fn: (...args: never[]) => unknown): void {
  ipcMain.handle(channel, async (_e, ...args) => {
    try {
      return { ok: true, value: await (fn as (...a: unknown[]) => unknown)(...args) }
    } catch (e) {
      const message = redact(e instanceof Error ? e.message : String(e))
      log('ipc_error', { channel, message })
      return { ok: false, error: message }
    }
  })
}

function registerIpc(): void {
  handle('km:getState', () => ({
    snapshot: sessionMgr.snap,
    settings: s(),
    interrupted,
    presets: PRESETS,
    asr: asr.status,
    preview: outgoingPreview(),
    resumable: db.lastResumable(),
    version: app.getVersion()
  }))
  handle('km:settings:patch', (p: DeepPartial<Settings>) => {
    const prev = structuredClone(s())
    settings.patch(p)
    applySettings(prev)
    return s()
  })

  handle('km:providers:list', () => registry.list())
  handle('km:providers:upsert', (cfg: ProviderConfig, apiKey?: string | null) => {
    const check = checkEndpoint(cfg.baseUrl)
    if (!check.ok) throw new Error(check.error)
    const saved = registry.upsert({ ...cfg, id: cfg.id || randomUUID().slice(0, 8), protocol: PRESETS[cfg.preset].protocol }, apiKey)
    updateLlmStatus()
    return { provider: saved, warning: check.warning ?? null }
  })
  handle('km:providers:remove', (id: string) => {
    registry.remove(id)
    updateLlmStatus()
    broadcast('km:settings', s())
  })
  handle('km:providers:models', (id: string, refresh?: boolean) => registry.models(id, refresh))
  handle('km:providers:test', async (id: string, model: string | null) => {
    const r = await registry.test(id, model)
    updateLlmStatus()
    return r
  })

  handle('km:session:start', (mode: 'practice' | 'live' | 'meeting') => startSession(mode))
  handle('km:session:resume', () => resumeSession())
  handle('km:session:stop', () => stopSession())
  handle('km:session:toggleListen', () => toggleListen())
  handle('km:session:answerNow', (kind?: AnswerKind) => sessionMgr.answerNow(kind ?? 'say', 'manual'))
  handle('km:session:askTyped', (text: string) => {
    if (!sessionMgr.active) startSession('practice')
    sessionMgr.askTyped(text)
  })
  handle('km:session:confirm', (id: string) => sessionMgr.confirmCandidate(id))
  handle('km:session:dismiss', (id: string) => sessionMgr.dismissCandidate(id))
  handle('km:session:edit', (text: string) => sessionMgr.editQuestion(text))
  handle('km:session:next', () => sessionMgr.nextQuestion())
  handle('km:session:panic', () => panic())
  handle('km:budget:approve', () => sessionMgr.approveBudget())
  handle('km:preview', () => outgoingPreview())

  ipcMain.on(
    'km:audio',
    (_e, m: { sessionId: string; utteranceId: string; source: Source; pcm: ArrayBuffer; startAt: number; endAt: number; final: boolean }) => {
      if (!sessionMgr.active || m.sessionId !== sessionMgr.snap.sessionId || !sessionMgr.snap.listening) return
      const startedAt = Date.now() - sessionMgr.sessionClockMs()
      asr.push({
        sessionId: m.sessionId,
        utteranceId: m.utteranceId,
        source: m.source,
        pcm: new Int16Array(m.pcm),
        startMs: Math.max(0, m.startAt - startedAt),
        endMs: Math.max(0, m.endAt - startedAt),
        final: m.final
      })
    }
  )
  ipcMain.on('km:csp', (_e, m: { url: string; directive: string }) => {
    log('renderer_blocked', { url: String(m.url).split('?')[0].slice(0, 200), by: 'csp', directive: String(m.directive).slice(0, 40) })
  })
  ipcMain.on('km:level', (_e, m: { source: Source; rms: number }) => {
    sessionMgr.setLevel(m.source, m.rms)
    emit()
  })
  ipcMain.on('km:audio-status', (_e, m: { source: Source; state: 'ok' | 'off' | 'warn' | 'error'; label: string }) => {
    sessionMgr.setStatus(m.source === 'user' ? 'mic' : 'system', { state: m.state, label: m.label })
    if (m.state === 'error') log('audio_error', m)
  })

  handle('km:overlay:toggle', () => toggleOverlay())
  handle('km:overlay:expand', (v: boolean) => {
    settings.patch({ overlay: { expanded: v } })
    broadcast('km:settings', s())
    if (v && !sessionMgr.snap.answers.deep && sessionMgr.snap.activeQuestion) sessionMgr.answerNow('deep', 'manual')
  })
  handle('km:overlay:fit', (h: number) => {
    if (!overlay) return
    const b = overlay.getBounds()
    overlay.setBounds({ ...b, height: Math.max(120, Math.min(900, Math.round(h))) })
  })
  handle('km:copy', (text: string) => {
    clipboard.writeText(text)
  })

  handle('km:screen:begin', () => beginRegion())
  handle('km:screen:submit', (png: string, task: ScreenTask, withCode: boolean, codeLang: string) => submitRegion(png, task, withCode, codeLang))
  handle('km:screen:cancel', () => picker?.close())

  handle('km:profiles:list', () => db.listProfiles())
  handle('km:profiles:upsert', (p: Profile) => {
    const saved = { ...p, id: p.id || randomUUID().slice(0, 8) }
    db.upsertProfile(saved)
    return saved
  })
  handle('km:profiles:remove', (id: string) => {
    if (db.listProfiles().length <= 1) throw new Error('Нельзя удалить последний профиль')
    db.deleteProfile(id)
    if (s().activeProfileId === id) settings.patch({ activeProfileId: db.listProfiles()[0].id })
    sessionMgr.reloadKnowledge()
  })
  handle('km:knowledge:list', (profileId: string) => db.listDocs(profileId))
  handle('km:knowledge:import', async (profileId: string, kind: 'cv' | 'jd' | 'notes') => {
    const r = await dialog.showOpenDialog(dashboard!, {
      title: 'Выберите документ',
      properties: ['openFile'],
      filters: [{ name: 'Документы', extensions: ['pdf', 'docx', 'txt', 'md'] }]
    })
    if (r.canceled || !r.filePaths[0]) return null
    const path = r.filePaths[0]
    const text = await extractText(path)
    if (!text.trim()) throw new Error('В документе не найден текст (возможно, это скан — нужен OCR)')
    const pieces = chunkText(text)
    const docId = randomUUID()
    const name = path.split(/[\\/]/).pop()!
    db.addDocument(
      { id: docId, profileId, name, kind },
      pieces.map((p) => ({ id: randomUUID(), section: p.section, text: p.text }))
    )
    sessionMgr.reloadKnowledge()
    return { name, chunks: pieces.length, chars: text.length }
  })
  handle('km:knowledge:addText', (profileId: string, kind: 'cv' | 'jd' | 'notes', name: string, text: string) => {
    const pieces = chunkText(text)
    db.addDocument(
      { id: randomUUID(), profileId, name, kind },
      pieces.map((p) => ({ id: randomUUID(), section: p.section, text: p.text }))
    )
    sessionMgr.reloadKnowledge()
    return { name, chunks: pieces.length, chars: text.length }
  })
  handle('km:knowledge:remove', (docId: string) => {
    db.deleteDoc(docId)
    sessionMgr.reloadKnowledge()
  })

  handle('km:history:list', (q?: string) => db.listSessions(q))
  handle('km:history:get', (id: string) => db.sessionDetail(id))
  handle('km:history:remove', (id: string) => db.deleteSession(id))
  handle('km:history:removeAll', () => db.deleteAllHistory())
  handle('km:history:export', async (id: string, fmt: 'md' | 'json') => {
    const content = exportSession(db.sessionDetail(id), fmt)
    const r = await dialog.showSaveDialog(dashboard!, {
      defaultPath: `copilot-session-${id.slice(0, 8)}.${fmt}`,
      filters: [{ name: fmt.toUpperCase(), extensions: [fmt] }]
    })
    if (r.canceled || !r.filePath) return null
    writeFileSync(r.filePath, content, 'utf8')
    return r.filePath
  })

  handle('km:asr:status', () => asr.status)
  handle('km:asr:install', async (backend: AsrBackend, model: string) => {
    const progress = (p: { name: string; received: number; total: number }) => {
      asr.setDownload(p)
    }
    try {
      if (!assets.serverPath(backend)) await assets.downloadBinary(backend, progress)
      if (!assets.hasModel(model)) await assets.downloadModel(model, progress)
      asr.setDownload(null)
      const prev = structuredClone(s())
      settings.patch({ asr: { backend, model } })
      applySettings(prev)
      return await asr.ensure()
    } catch (e) {
      asr.setDownload(null, e instanceof Error ? e.message : String(e))
      throw e
    }
  })
  handle('km:ocr:install', () => ocr.install().then(updateLlmStatus))
  handle('km:gpu', async () => {
    const info = (await app.getGPUInfo('basic')) as { gpuDevice?: { vendorId: number; active?: boolean }[] }
    return (info.gpuDevice ?? []).some((g) => g.vendorId === 0x10de)
  })

  handle('km:diagnostics', () =>
    runDiagnostics({
      settings: s(),
      registry,
      asr,
      ocr,
      secretsOk: secrets.available(),
      shortcutConflicts: [...shortcutConflicts],
      protectionSupported: displayProtectionSupported(),
      db,
      guard
    })
  )
  handle('km:diagnostics:log', () => db.recentDiag(100))
  handle('km:media:access', () => mediaAccess())
  handle('km:media:openPrivacy', (kind: 'microphone' | 'screen') => openPrivacyPane(kind))
  handle('km:open', (url: string) => {
    if (/^https:\/\//.test(url)) void shell.openExternal(url)
  })
}

app.whenReady().then(() => {
  ensureDefaultProfile()
  secrets = new SecretStore(join(dataDir, 'secrets.bin'), {
    available: () => safeStorage.isEncryptionAvailable(),
    encrypt: (v) => safeStorage.encryptString(v),
    decrypt: (b) => safeStorage.decryptString(b)
  })
  registry = new ProviderRegistry(settings, secrets, guard)
  assets = new AsrAssets(join(dataDir, 'asr'), guard.fetch)
  ocr = new Ocr(join(dataDir, 'ocr'), guard.fetch)
  const dayStart = new Date()
  dayStart.setHours(0, 0, 0, 0)
  budget = new BudgetManager(s().budget, s().pricing, { now: Date.now, spentTodayBefore: () => db.spentSince(dayStart.getTime()) })
  sessionMgr = new SessionManager({
    settings: s,
    db,
    profile,
    resolve: (role) => registry.resolve(role, s()),
    fallback: (role, exclude) => registry.fallback(role, exclude, s()),
    budget,
    newId: () => randomUUID(),
    now: Date.now,
    emit,
    log,
    outcome: (providerId, model, ok) => {
      const key = `${providerId}/${model}`
      if (registry.textOk.get(key) === ok) return
      registry.textOk.set(key, ok)
      updateLlmStatus()
    }
  })
  const sileroModel = app.isPackaged ? join(process.resourcesPath, 'silero_vad.onnx') : join(app.getAppPath(), 'resources', 'silero_vad.onnx')
  const silero = new SileroGate(sileroModel, log)
  asr = new AsrManager(
    assets,
    guard.fetch,
    asrConfig(),
    {
      segment: (seg) => sessionMgr.onSegment(seg),
      status: (st) => {
        sessionMgr.snap.status.asr = st.download
          ? { state: 'busy', label: `загрузка ${st.download.name}: ${Math.round((st.download.received / Math.max(1, st.download.total)) * 100)}%` }
          : st.error
            ? { state: 'error', label: st.error }
            : !st.binary || !st.modelPresent
              ? { state: 'warn', label: 'не установлено' }
              : st.running
                ? { state: 'ok', label: `whisper ${st.model} · локально${st.lastLatencyMs ? ` · ${st.lastLatencyMs} мс` : ''}` }
                : { state: 'ok', label: `whisper ${st.model} · установлен` }
        broadcast('km:asr', st)
        emit()
      },
      log
    },
    silero
  )
  guard.onBlocked((url, reason) => log('blocked', { url, reason }))
  lockDownSessions()
  registerIpc()
  applySettings(null)
  applyProtection()
  if (interrupted) sessionMgr.snap.notice = 'Прошлая сессия завершилась аварийно — её транскрипт сохранён в «Истории».'

  const icon = nativeImage.createFromBuffer(appIcon(64))
  tray = new Tray(icon.resize({ width: 16, height: 16 }))
  tray.on('click', showDashboard)
  refreshTray()
  dashboard = makeDashboard()
  dashboard.setIcon(icon)
})

app.on('second-instance', showDashboard)
app.on('before-quit', () => {
  quitting = true
  sessionMgr?.stop()
  asr?.stop()
  void ocr?.dispose()
  globalShortcut.unregisterAll()
  db.close()
})
app.on('window-all-closed', () => {
  if (quitting) app.quit()
})
