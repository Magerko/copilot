import type { DiagCheck, DiagReport, ModelRole, Settings } from '@shared/types'
import type { AsrManager } from './asr/manager'
import type { NetGuard } from './net/guard'
import type { ProviderRegistry } from './providers/registry'
import { toAppError } from './providers/errors'
import type { Ocr } from './screen/ocr'
import type { Db } from './storage/db'

export interface DiagDeps {
  settings: Settings
  registry: ProviderRegistry
  asr: AsrManager
  ocr: Ocr
  secretsOk: boolean
  shortcutConflicts: string[]
  protectionSupported: boolean
  db: Db
  guard: NetGuard
}

const ROLE_LABEL: Partial<Record<ModelRole, string>> = { quick_answer: 'Быстрый ответ', deep_answer: 'Подробный ответ', vision: 'Изображения' }

export async function runDiagnostics(d: DiagDeps): Promise<DiagReport> {
  const checks: DiagCheck[] = []
  const add = (id: string, label: string, ok: boolean | null, detail: string) => checks.push({ id, label, ok, detail })

  add(
    'secrets',
    'Хранилище ключей (DPAPI)',
    d.secretsOk,
    d.secretsOk ? 'Ключи шифруются системой Windows под вашей учётной записью' : 'Шифрование недоступно — ключи не сохраняются'
  )

  const st = d.asr.status
  if (!st.binary || !st.modelPresent) add('asr', 'Распознавание речи', false, 'Не установлено — откройте «Речь и звук» → «Установить»')
  else {
    const ok = await d.asr.ensure()
    add(
      'asr',
      'Распознавание речи',
      ok,
      ok
        ? `whisper ${st.model} запущен локально${st.lastLatencyMs ? `, последняя задержка ${st.lastLatencyMs} мс` : ''}`
        : (d.asr.status.error ?? 'не запускается')
    )
  }

  for (const role of Object.keys(ROLE_LABEL) as ModelRole[]) {
    const t = d.registry.resolve(role, d.settings)
    if (!t) {
      add(`role:${role}`, ROLE_LABEL[role]!, role === 'quick_answer' ? false : null, 'Модель не выбрана')
      continue
    }
    const t0 = Date.now()
    try {
      await d.registry.models(t.cfg.id, true)
      add(`role:${role}`, ROLE_LABEL[role]!, true, `${t.cfg.label} · ${t.model} — соединение ${Date.now() - t0} мс${t.isLocal ? ' · локально' : ''}`)
    } catch (e) {
      const err = toAppError(e)
      add(`role:${role}`, ROLE_LABEL[role]!, false, `${t.cfg.label}: ${err.message}${err.detail ? ` (${err.detail})` : ''}`)
    }
  }

  add(
    'shortcuts',
    'Горячие клавиши',
    d.shortcutConflicts.length === 0,
    d.shortcutConflicts.length ? `Конфликты: ${d.shortcutConflicts.join('; ')}` : 'Все сочетания зарегистрированы, конфликтов нет'
  )
  add(
    'protection',
    'Защита окна подсказок от захвата',
    d.protectionSupported ? null : false,
    d.protectionSupported
      ? 'Системный флаг WDA_EXCLUDEFROMCAPTURE доступен. Результат зависит от способа захвата — проверьте у получателя: начните демонстрацию экрана и попросите собеседника сказать, видно ли окно подсказок.'
      : 'Нужна Windows 10 2004 или новее'
  )

  if (d.settings.offline) {
    try {
      await d.guard.fetch('https://example.com/')
      add('offline', 'Офлайн-режим', false, 'Внешний запрос НЕ заблокирован')
    } catch {
      add('offline', 'Офлайн-режим', true, 'Внешние адреса заблокированы на уровне приложения')
    }
  } else add('offline', 'Офлайн-режим', null, 'Выключен: разрешены запросы к выбранным провайдерам')

  add(
    'ocr',
    'Локальный OCR',
    d.ocr.installed() ? true : null,
    d.ocr.installed() ? 'Установлен (eng, rus, ukr)' : 'Не установлен — нужен только для моделей без vision'
  )

  const integrity = (d.db.sql.prepare('PRAGMA quick_check').get() as Record<string, string>)?.quick_check
  add('db', 'Локальная база', integrity === 'ok', integrity === 'ok' ? 'Целостность в порядке' : `Проблема: ${integrity}`)

  return { at: Date.now(), checks }
}
