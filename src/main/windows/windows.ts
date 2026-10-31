import { BrowserWindow, screen, type Rectangle } from 'electron'
import { join } from 'node:path'
import { release } from 'node:os'
import type { OverlaySettings } from '@shared/types'

const preload = join(__dirname, '../preload/index.js')

function load(win: BrowserWindow, page: 'index' | 'overlay' | 'picker', hash = ''): void {
  const dev = process.env.ELECTRON_RENDERER_URL
  if (dev) void win.loadURL(`${dev}/${page}.html${hash}`)
  else void win.loadFile(join(__dirname, `../renderer/${page}.html`), { hash: hash.replace(/^#/, '') })
}

const webPreferences = {
  preload,
  contextIsolation: true,
  sandbox: true,
  nodeIntegration: false,
  spellcheck: false
}

export function createDashboard(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1180,
    height: 780,
    minWidth: 880,
    minHeight: 600,
    show: false,
    title: 'Copilot',
    backgroundColor: '#0f1115',
    autoHideMenuBar: true,
    // Audio capture lives in this renderer, so I keep it running while minimized to tray.
    webPreferences: { ...webPreferences, backgroundThrottling: false }
  })
  load(win, 'index')
  win.once('ready-to-show', () => win.show())
  return win
}

/**
 * WDA_EXCLUDEFROMCAPTURE exists since Windows 10 2004 (build 19041). On macOS Electron sets NSWindowSharingNone,
 * which every supported version accepts, though ScreenCaptureKit-based tools may still capture the window.
 */
export function displayProtectionSupported(platform: NodeJS.Platform = process.platform, osRelease = release()): boolean {
  if (platform === 'darwin') return true
  if (platform !== 'win32') return false
  const build = Number(osRelease.split('.')[2] ?? 0)
  return build >= 19041
}

export function defaultOverlayBounds(size: OverlaySettings['size'] = { width: 640, height: 440 }): Rectangle {
  const wa = screen.getPrimaryDisplay().workArea
  const width = Math.min(size.width, wa.width - 48)
  const height = Math.min(220, size.height)
  return { x: wa.x + wa.width - width - 24, y: wa.y + 24, width, height }
}

/** I restore saved bounds only if they are still visible on some connected display. */
export function sanitizeBounds(b: OverlaySettings['bounds'], size?: OverlaySettings['size']): Rectangle {
  if (!b) return defaultOverlayBounds(size)
  const visible = screen.getAllDisplays().some((d) => {
    const wa = d.workArea
    return b.x + 60 > wa.x && b.x < wa.x + wa.width - 60 && b.y >= wa.y - 10 && b.y < wa.y + wa.height - 40
  })
  return visible ? b : defaultOverlayBounds(size)
}

export function createOverlay(o: OverlaySettings): BrowserWindow {
  const bounds = { ...sanitizeBounds(o.bounds, o.size), width: o.size.width }
  if (o.expanded) bounds.height = o.size.height
  const win = new BrowserWindow({
    ...bounds,
    minWidth: 360,
    minHeight: 120,
    show: false,
    frame: false,
    resizable: true,
    movable: true,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    alwaysOnTop: o.pinned,
    // I never let it take keyboard focus: typing in the IDE/meeting app keeps going there (FR-O01, FR-O05; spike S1).
    focusable: false,
    hasShadow: false,
    // I make it transparent so the panel background can be semi-see-through while the text stays fully opaque (CSS controls the alpha).
    transparent: true,
    backgroundColor: '#00000000',
    title: 'Copilot — подсказки',
    webPreferences: { ...webPreferences, backgroundThrottling: false }
  })
  if (o.pinned) win.setAlwaysOnTop(true, 'screen-saver')
  load(win, 'overlay')
  return win
}

export function createPicker(display: Electron.Display): BrowserWindow {
  const win = new BrowserWindow({
    ...display.bounds,
    show: false,
    frame: false,
    resizable: false,
    movable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    fullscreenable: false,
    backgroundColor: '#000000',
    webPreferences
  })
  win.setAlwaysOnTop(true, 'screen-saver')
  win.setContentProtection(true)
  load(win, 'picker')
  return win
}
