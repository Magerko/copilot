import { createHash } from 'node:crypto'
import { createWriteStream, existsSync, mkdirSync, readdirSync, renameSync, rmSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { spawn } from 'node:child_process'
import type { FetchFn } from '../providers/adapter'

export type AsrBackend = 'cpu' | 'cuda'

export interface ModelAsset {
  name: string
  file: string
  sizeMb: number
  sha256: string
  label: string
}

// I measured these hashes in spike S2 (FINDINGS.md); a mismatch means a corrupted or substituted download.
export const MODELS: Record<string, ModelAsset> = {
  base: {
    name: 'base',
    file: 'ggml-base.bin',
    sizeMb: 148,
    sha256: '60ed5bc3dd14eea856493d334349b405782ddcaf0028d4b5df4088345fba2efe',
    label: 'Base — быстрая, для CPU'
  },
  small: {
    name: 'small',
    file: 'ggml-small.bin',
    sizeMb: 488,
    sha256: '1be3a9b2063867b937e64e2ec7483364a79917e157fa98c5d94b5c1fffea987b',
    label: 'Small — точнее, медленнее на CPU'
  },
  turbo: {
    name: 'turbo',
    file: 'ggml-large-v3-turbo-q5_0.bin',
    sizeMb: 574,
    sha256: '394221709cd5ad1f40c46e6031ca61bce88931e6e088c188294c6d5a55ffa7e2',
    label: 'Large v3 Turbo — лучшая точность, нужна NVIDIA'
  }
}

const RELEASE = 'b5454'
// I copied these digests from the GitHub release API for b5454 (2026-10-28) and pin them so a failed API call never skips the check.
export const BINARIES: Record<AsrBackend, { url: string; sha256: string; sizeMb: number; label: string }> = {
  cpu: {
    url: `https://github.com/ggml-org/whisper.cpp/releases/download/${RELEASE}/whisper-bin-x64.zip`,
    sha256: '6ba69e3482d7826214f90a6a9c84ca07782aec1e1d0c6a7c30c994fd5d816ccb',
    sizeMb: 9,
    label: 'whisper.cpp (CPU)'
  },
  cuda: {
    url: `https://github.com/ggml-org/whisper.cpp/releases/download/${RELEASE}/whisper-bin-win-cuda-12.4.0-x64.zip`,
    sha256: 'afef0b881c500958921c3f5523b50e59ee2ec9b6f5cbd25b324c51ed308a957a',
    sizeMb: 685,
    label: 'whisper.cpp (NVIDIA CUDA)'
  }
}

export interface Progress {
  name: string
  received: number
  total: number
}

export class AsrAssets {
  constructor(
    private root: string,
    private fetch: FetchFn
  ) {
    mkdirSync(join(root, 'models'), { recursive: true })
  }

  modelPath(name: string): string {
    return join(this.root, 'models', MODELS[name]?.file ?? `ggml-${name}.bin`)
  }

  hasModel(name: string): boolean {
    return existsSync(this.modelPath(name))
  }

  serverPath(backend: AsrBackend): string | null {
    if (process.platform === 'darwin') return macServerPath()
    const dir = join(this.root, backend)
    if (!existsSync(dir)) return null
    const found = findFile(dir, 'whisper-server.exe')
    return found
  }

  async downloadModel(name: string, onProgress: (p: Progress) => void, signal?: AbortSignal): Promise<void> {
    const m = MODELS[name]
    if (!m) throw new Error(`Неизвестная модель ${name}`)
    const url = `https://huggingface.co/ggerganov/whisper.cpp/resolve/main/${m.file}`
    const tmp = this.modelPath(name) + '.part'
    const sha = await this.download(url, tmp, m.label, onProgress, signal)
    if (sha !== m.sha256) {
      rmSync(tmp, { force: true })
      throw new Error(`Контрольная сумма модели не совпала (${sha.slice(0, 12)}…) — файл удалён`)
    }
    renameSync(tmp, this.modelPath(name))
  }

  async downloadBinary(backend: AsrBackend, onProgress: (p: Progress) => void, signal?: AbortSignal): Promise<void> {
    if (process.platform === 'darwin') return installMacServer(onProgress)
    const b = BINARIES[backend]
    const zip = join(this.root, `${backend}.zip.part`)
    const sha = await this.download(b.url, zip, b.label, onProgress, signal)
    if (sha !== b.sha256) {
      rmSync(zip, { force: true })
      throw new Error(`Контрольная сумма архива не совпала (${sha.slice(0, 12)}…) — файл удалён`)
    }
    const dir = join(this.root, backend)
    rmSync(dir, { recursive: true, force: true })
    mkdirSync(dir, { recursive: true })
    // bsdtar ships with Windows 10 1803+ and reads zip; a Git/MSYS tar earlier in PATH does not.
    await run(join(process.env.SystemRoot ?? 'C:\\Windows', 'System32', 'tar.exe'), ['-xf', zip, '-C', dir])
    rmSync(zip, { force: true })
    if (!this.serverPath(backend)) throw new Error('В архиве нет whisper-server.exe')
  }

  private async download(url: string, dest: string, name: string, onProgress: (p: Progress) => void, signal?: AbortSignal): Promise<string> {
    const res = await this.fetch(url, { signal, redirect: 'follow' })
    if (!res.ok || !res.body) throw new Error(`Загрузка не удалась: HTTP ${res.status}`)
    const total = Number(res.headers.get('content-length') ?? 0)
    const hash = createHash('sha256')
    const out = createWriteStream(dest)
    let received = 0
    let lastEmit = 0
    try {
      const reader = res.body.getReader()
      while (true) {
        const { value, done } = await reader.read()
        if (done) break
        hash.update(value)
        received += value.length
        if (!out.write(value)) await new Promise<void>((r) => out.once('drain', () => r()))
        if (Date.now() - lastEmit > 250) {
          lastEmit = Date.now()
          onProgress({ name, received, total })
        }
      }
    } catch (e) {
      out.destroy()
      rmSync(dest, { force: true })
      throw e
    }
    await new Promise<void>((resolve, reject) => out.end((err?: Error | null) => (err ? reject(err) : resolve())))
    onProgress({ name, received, total: total || received })
    return hash.digest('hex')
  }
}

function findFile(dir: string, name: string): string | null {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry)
    if (entry.toLowerCase() === name) return p
    if (statSync(p).isDirectory()) {
      const r = findFile(p, name)
      if (r) return r
    }
  }
  return null
}

// whisper.cpp ships no macOS server binary in its releases; Homebrew's build has whisper-server with Metal.
const MAC_BIN_DIRS = ['/opt/homebrew/bin', '/usr/local/bin']

function macServerPath(): string | null {
  for (const dir of MAC_BIN_DIRS) {
    const p = join(dir, 'whisper-server')
    if (existsSync(p)) return p
  }
  return null
}

async function installMacServer(onProgress: (p: Progress) => void): Promise<void> {
  const brew = MAC_BIN_DIRS.map((d) => join(d, 'brew')).find((p) => existsSync(p))
  if (!brew) throw new Error('Нужен Homebrew (https://brew.sh), затем в Терминале: brew install whisper-cpp')
  onProgress({ name: 'whisper.cpp (Homebrew)', received: 0, total: 0 })
  await run(brew, ['install', 'whisper-cpp'], { HOMEBREW_NO_AUTO_UPDATE: '1' })
  if (!macServerPath()) throw new Error('Homebrew не установил whisper-server — выполните в Терминале: brew install whisper-cpp')
}

function run(cmd: string, args: string[], env?: Record<string, string>): Promise<void> {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { windowsHide: true, env: env ? { ...process.env, ...env } : process.env })
    p.on('error', reject)
    p.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`${cmd} завершился с кодом ${code}`))))
  })
}
