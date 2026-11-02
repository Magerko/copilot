import type { UiLang } from '../types'
import { CORE } from './core'
import { DASHBOARD } from './dashboard'
import { MAIN } from './main'
import { SETTINGS } from './settings'
import type { Dict } from './types'

export type { Dict } from './types'

// I use the Russian text as the key; each process (main, every window) keeps its own current language.
export const DICT: Dict = { ...CORE, ...SETTINGS, ...DASHBOARD, ...MAIN }

let lang: UiLang = 'ru'

export function setLang(l: UiLang): void {
  lang = l
  if (typeof document !== 'undefined') document.documentElement.lang = l
}

export function getLang(): UiLang {
  return lang
}

/** Translates the Russian source text; {name} placeholders are filled from vars after translation. */
export function t(ru: string, vars?: Record<string, string | number>): string {
  const e = lang === 'ru' ? undefined : DICT[ru]
  let out = e ? (lang === 'uk' ? e[0] : e[1]) : ru
  if (vars) for (const [k, v] of Object.entries(vars)) out = out.split(`{${k}}`).join(String(v))
  return out
}
