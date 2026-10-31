import { existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { registerSecret, unregisterSecret } from './redact'
import { t } from '@shared/i18n'

export interface Cipher {
  available(): boolean
  encrypt(plain: string): Buffer
  decrypt(data: Buffer): string
}

/**
 * I never let keys touch settings.json or SQLite. The file holds only Electron safeStorage blobs
 * (DPAPI on Windows, a Keychain-held key on macOS), which decrypt solely under the same OS user.
 */
export class SecretStore {
  private blobs: Record<string, string> = {}

  constructor(
    private path: string,
    private cipher: Cipher
  ) {
    if (existsSync(path)) {
      try {
        this.blobs = JSON.parse(readFileSync(path, 'utf8'))
      } catch {
        this.blobs = {}
      }
    }
    for (const id of Object.keys(this.blobs)) {
      const v = this.get(id)
      if (v) registerSecret(v)
    }
  }

  available(): boolean {
    return this.cipher.available()
  }

  has(id: string): boolean {
    return id in this.blobs
  }

  get(id: string): string | null {
    const b = this.blobs[id]
    if (!b) return null
    try {
      return this.cipher.decrypt(Buffer.from(b, 'base64'))
    } catch {
      return null
    }
  }

  set(id: string, value: string): void {
    if (!this.cipher.available()) throw new Error(t('Системное шифрование недоступно — ключ не сохранён'))
    const old = this.get(id)
    if (old) unregisterSecret(old)
    this.blobs[id] = this.cipher.encrypt(value).toString('base64')
    registerSecret(value)
    this.flush()
  }

  delete(id: string): void {
    const old = this.get(id)
    if (old) unregisterSecret(old)
    delete this.blobs[id]
    this.flush()
  }

  private flush(): void {
    const tmp = this.path + '.tmp'
    writeFileSync(tmp, JSON.stringify(this.blobs), { mode: 0o600 })
    renameSync(tmp, this.path)
  }
}
