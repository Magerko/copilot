import { isMac } from './api'

const MAC_SYMBOLS: Record<string, string> = {
  Control: '⌃',
  Ctrl: '⌃',
  Alt: '⌥',
  Option: '⌥',
  Shift: '⇧',
  Command: '⌘',
  Cmd: '⌘',
  CommandOrControl: '⌘',
  CmdOrCtrl: '⌘',
  Super: '⌘',
  Meta: '⌘',
  Up: '↑',
  Down: '↓',
  Left: '←',
  Right: '→',
  Enter: '↩',
  Return: '↩',
  Backspace: '⌫',
  Delete: '⌦',
  Escape: '⎋',
  Space: '␣',
  Tab: '⇥'
}

const WIN_NAMES: Record<string, string> = { Control: 'Ctrl', CommandOrControl: 'Ctrl', CmdOrCtrl: 'Ctrl', Super: 'Win', Meta: 'Win' }

/** Electron accelerator → what the user sees: «⌃⌥H» on macOS, «Ctrl + Alt + H» on Windows. */
export function pretty(accel: string): string {
  const parts = accel.split('+')
  if (isMac) return parts.map((p) => MAC_SYMBOLS[p] ?? p).join('')
  return parts.map((p) => WIN_NAMES[p] ?? p).join(' + ')
}

const NAMED: Record<string, string> = {
  Space: 'Space',
  ArrowUp: 'Up',
  ArrowDown: 'Down',
  ArrowLeft: 'Left',
  ArrowRight: 'Right',
  Enter: 'Enter',
  NumpadEnter: 'Enter',
  Backspace: 'Backspace',
  Delete: 'Delete',
  Escape: 'Escape',
  Tab: 'Tab'
}

/**
 * Key event → Electron accelerator. I read the physical key (e.code): on macOS Option turns «H» into «˙» in e.key,
 * and a non-Latin layout would otherwise record Cyrillic letters the accelerator parser rejects.
 */
export function toAccelerator(e: Pick<KeyboardEvent, 'ctrlKey' | 'altKey' | 'shiftKey' | 'metaKey' | 'key' | 'code'>, mac = isMac): string | null {
  if (['Control', 'Alt', 'Shift', 'Meta'].includes(e.key)) return null
  const mods = [e.ctrlKey && 'Control', e.altKey && 'Alt', e.shiftKey && 'Shift', e.metaKey && (mac ? 'Command' : 'Super')].filter(Boolean) as string[]
  const c = e.code
  const key = /^Key[A-Z]$/.test(c)
    ? c.slice(3)
    : /^Digit\d$/.test(c)
      ? c.slice(5)
      : /^F\d{1,2}$/.test(c)
        ? c
        : (NAMED[c] ?? (e.key.length === 1 ? e.key.toUpperCase() : e.key))
  if (!mods.length && !/^F\d+$/.test(key)) return null
  return [...mods, key].join('+')
}
