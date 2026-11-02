import { chmodSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { AsrAssets, macInstallHint } from '../src/main/asr/assets'
import { displayProtectionSupported } from '../src/main/windows/windows'

const noFetch = (() => Promise.reject(new Error('no network in tests'))) as never

function exe(dir: string, name: string): string {
  mkdirSync(dir, { recursive: true })
  const p = join(dir, name)
  writeFileSync(p, '#!/bin/sh\n')
  chmodSync(p, 0o755)
  return p
}

describe('ASR assets on macOS', () => {
  it('finds whisper-server on PATH (Homebrew) for any backend', () => {
    const root = mkdtempSync(join(tmpdir(), 'asr-'))
    const bin = join(root, 'bin')
    const server = exe(bin, 'whisper-server')
    const a = new AsrAssets(join(root, 'data'), noFetch, 'darwin', { PATH: `/nonexistent:${bin}` })
    expect(a.serverPath('cpu')).toBe(server)
    expect(a.serverPath('cuda')).toBe(server)
  })

  it('prefers a local Metal build over PATH', () => {
    const root = mkdtempSync(join(tmpdir(), 'asr-'))
    exe(join(root, 'bin'), 'whisper-server')
    const local = exe(join(root, 'data', 'metal', 'build', 'bin'), 'whisper-server')
    const a = new AsrAssets(join(root, 'data'), noFetch, 'darwin', { PATH: join(root, 'bin') })
    expect(a.serverPath('cpu')).toBe(local)
  })

  it('ignores a non-executable file', () => {
    const root = mkdtempSync(join(tmpdir(), 'asr-'))
    mkdirSync(join(root, 'bin'))
    writeFileSync(join(root, 'bin', 'whisper-server'), '')
    const a = new AsrAssets(join(root, 'data'), noFetch, 'darwin', { PATH: join(root, 'bin') })
    // /opt/homebrew/bin may hold a real install on the dev machine, so I only assert the plain file is not picked.
    expect(a.serverPath('cpu')).not.toBe(join(root, 'bin', 'whisper-server'))
  })

  it('never downloads the Windows zip and explains how to install instead', async () => {
    const a = new AsrAssets(mkdtempSync(join(tmpdir(), 'asr-')), noFetch, 'darwin', { PATH: '' })
    await expect(a.downloadBinary('cpu', () => {})).rejects.toThrow(macInstallHint())
    expect(macInstallHint()).toContain('brew install whisper-cpp')
  })

  it('keeps the Windows lookup unchanged', () => {
    const root = mkdtempSync(join(tmpdir(), 'asr-'))
    exe(join(root, 'bin'), 'whisper-server')
    const a = new AsrAssets(join(root, 'data'), noFetch, 'win32', { PATH: join(root, 'bin') })
    expect(a.serverPath('cpu')).toBeNull()
  })
})

describe('capture protection support', () => {
  it('is available on macOS and on Windows 10 2004+', () => {
    expect(displayProtectionSupported('darwin', '25.0.0')).toBe(true)
    expect(displayProtectionSupported('win32', '10.0.19041')).toBe(true)
    expect(displayProtectionSupported('win32', '10.0.18363')).toBe(false)
    expect(displayProtectionSupported('linux', '6.8.0')).toBe(false)
  })
})
