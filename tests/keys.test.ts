import { describe, expect, it, vi } from 'vitest'

// keys.ts reads the platform from the preload bridge at import time.
async function load(platform: string) {
  vi.resetModules()
  vi.stubGlobal('window', { km: { platform } })
  return import('../src/renderer/lib/keys')
}

const ev = (o: Partial<KeyboardEvent>) => ({ ctrlKey: false, altKey: false, shiftKey: false, metaKey: false, key: '', code: '', ...o })

describe('shortcut display', () => {
  it('uses macOS symbols on darwin', async () => {
    const { pretty } = await load('darwin')
    expect(pretty('Control+Alt+H')).toBe('⌃⌥H')
    expect(pretty('Command+Shift+Enter')).toBe('⌘⇧↩')
    expect(pretty('Control+Alt+Backspace')).toBe('⌃⌥⌫')
  })

  it('keeps Windows names on win32', async () => {
    const { pretty } = await load('win32')
    expect(pretty('Control+Alt+H')).toBe('Ctrl + Alt + H')
    expect(pretty('Super+Up')).toBe('Win + Up')
  })
})

describe('shortcut recording', () => {
  it('reads the physical key when Option changes the character', async () => {
    const { toAccelerator } = await load('darwin')
    expect(toAccelerator(ev({ altKey: true, ctrlKey: true, key: '˙', code: 'KeyH' }))).toBe('Control+Alt+H')
  })

  it('records ⌘ as Command on macOS and Super elsewhere', async () => {
    expect((await load('darwin')).toAccelerator(ev({ metaKey: true, key: 'k', code: 'KeyK' }))).toBe('Command+K')
    expect((await load('win32')).toAccelerator(ev({ metaKey: true, key: 'k', code: 'KeyK' }))).toBe('Super+K')
  })

  it('records Latin letters on a Cyrillic layout', async () => {
    const { toAccelerator } = await load('win32')
    expect(toAccelerator(ev({ ctrlKey: true, altKey: true, key: 'р', code: 'KeyH' }))).toBe('Control+Alt+H')
  })

  it('ignores bare modifiers and plain letters', async () => {
    const { toAccelerator } = await load('darwin')
    expect(toAccelerator(ev({ ctrlKey: true, key: 'Control', code: 'ControlLeft' }))).toBeNull()
    expect(toAccelerator(ev({ key: 'h', code: 'KeyH' }))).toBeNull()
    expect(toAccelerator(ev({ key: 'F5', code: 'F5' }))).toBe('F5')
  })
})
