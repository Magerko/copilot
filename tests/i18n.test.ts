import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { DICT, setLang, t } from '../src/shared/i18n'

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n)
    return statSync(p).isDirectory() ? files(p) : /\.tsx?$/.test(n) ? [p] : []
  })
}

// Every literal passed to t() must have both translations, or the UI silently shows Russian in a Ukrainian/English app.
const KEY = /\bt\(\s*(['"])((?:\\.|(?!\1).)*)\1/g

describe('i18n', () => {
  afterEach(() => setLang('ru'))

  it('every t() key in the source has Ukrainian and English text', () => {
    const missing: string[] = []
    for (const f of files(join(__dirname, '../src'))) {
      if (f.includes(join('shared', 'i18n'))) continue
      for (const m of readFileSync(f, 'utf8').matchAll(KEY)) {
        const key = m[2].replace(/\\(['"\\])/g, '$1')
        if (!/[А-Яа-яЁё]/.test(key)) continue
        const e = DICT[key]
        if (!e || !e[0] || !e[1]) missing.push(`${f.split('/src/')[1]}: ${key}`)
      }
    }
    expect(missing).toEqual([])
  })

  it('fills placeholders after translating', () => {
    setLang('uk')
    expect(t('Сессия не запущена')).toBe('Сесію не запущено')
    setLang('en')
    expect(t('Неизвестный ключ {n}', { n: 3 })).toBe('Неизвестный ключ 3')
  })
})
