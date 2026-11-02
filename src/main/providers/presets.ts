import type { ProviderPreset, ProviderProtocol } from '@shared/types'
import { t } from '@shared/i18n'

export interface PresetInfo {
  label: string
  protocol: ProviderProtocol
  baseUrl: string
  needsKey: boolean
  keyUrl?: string
  note: string
}

export const PRESETS: Record<ProviderPreset, PresetInfo> = {
  openai: {
    label: 'OpenAI',
    protocol: 'openai',
    baseUrl: 'https://api.openai.com/v1',
    needsKey: true,
    keyUrl: 'https://platform.openai.com/api-keys',
    note: 'Текст и изображения. Данные уходят в OpenAI.'
  },
  anthropic: {
    label: 'Anthropic (Claude)',
    protocol: 'anthropic',
    baseUrl: 'https://api.anthropic.com',
    needsKey: true,
    keyUrl: 'https://platform.claude.com/settings/keys',
    note: 'Текст и изображения. Аудио не отправляется — только распознанный текст.'
  },
  gemini: {
    label: 'Google Gemini',
    protocol: 'gemini',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    needsKey: true,
    keyUrl: 'https://aistudio.google.com/apikey',
    note: 'Текст и изображения. Данные уходят в Google.'
  },
  anymodel: {
    label: 'AnyModel.org',
    protocol: 'openai',
    baseUrl: 'https://anymodel.org/v1',
    needsKey: true,
    keyUrl: 'https://anymodel.org',
    note: 'Шлюз — отдельный получатель данных: он пересылает запрос выбранной модели.'
  },
  ollama: {
    label: 'Ollama (локально)',
    protocol: 'openai',
    baseUrl: 'http://127.0.0.1:11434/v1',
    needsKey: false,
    note: 'Полностью на этом компьютере. Работает офлайн.'
  },
  lmstudio: {
    label: 'LM Studio (локально)',
    protocol: 'openai',
    baseUrl: 'http://127.0.0.1:1234/v1',
    needsKey: false,
    note: 'Локальный OpenAI-совместимый сервер.'
  },
  custom: {
    label: 'Свой endpoint (OpenAI-compatible)',
    protocol: 'openai',
    baseUrl: 'http://127.0.0.1:8000/v1',
    needsKey: false,
    note: 'vLLM, LiteLLM и любой совместимый сервер. Проверьте, кому уходят данные.'
  }
}

/** Labels and notes are Russian source text; I translate them when the UI asks, so they follow the current language. */
export function presetsForUi(): Record<ProviderPreset, PresetInfo> {
  const out = {} as Record<ProviderPreset, PresetInfo>
  for (const [k, p] of Object.entries(PRESETS) as [ProviderPreset, PresetInfo][]) out[k] = { ...p, label: t(p.label), note: t(p.note) }
  return out
}
