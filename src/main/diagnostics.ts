import type { DiagCheck, DiagReport, ModelRole, Settings } from '@shared/types'
import type { AsrManager } from './asr/manager'
import type { NetGuard } from './net/guard'
import type { ProviderRegistry } from './providers/registry'
import { toAppError } from './providers/errors'
import type { Ocr } from './screen/ocr'
import type { Db } from './storage/db'
import { t, t as tr } from '@shared/i18n'

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
const roleLabel = (role: ModelRole) => tr(ROLE_LABEL[role]!)

export async function runDiagnostics(d: DiagDeps): Promise<DiagReport> {
  const checks: DiagCheck[] = []
  const add = (id: string, label: string, ok: boolean | null, detail: string) => checks.push({ id, label, ok, detail })

  add(
    'secrets',
    t('Хранилище ключей'),
    d.secretsOk,
    d.secretsOk
      ? t('Ключи шифруются системой ({store}) под вашей учётной записью', { store: process.platform === 'darwin' ? t('Связка ключей macOS') : 'Windows DPAPI' })
      : t('Шифрование недоступно — ключи не сохраняются')
  )

  const st = d.asr.status
  if (!st.binary || !st.modelPresent) add('asr', t('Распознавание речи'), false, t('Не установлено — откройте «Речь и звук» → «Установить»'))
  else {
    const ok = await d.asr.ensure()
    add(
      'asr',
      t('Распознавание речи'),
      ok,
      ok
        ? t('whisper {model} запущен локально', { model: st.model }) + (st.lastLatencyMs ? t(', последняя задержка {ms} мс', { ms: st.lastLatencyMs }) : '')
        : (d.asr.status.error ?? t('не запускается'))
    )
  }

  for (const role of Object.keys(ROLE_LABEL) as ModelRole[]) {
    const t = d.registry.resolve(role, d.settings)
    if (!t) {
      add(`role:${role}`, roleLabel(role), role === 'quick_answer' ? false : null, tr('Модель не выбрана'))
      continue
    }
    const t0 = Date.now()
    try {
      await d.registry.models(t.cfg.id, true)
      add(
        `role:${role}`,
        roleLabel(role),
        true,
        `${t.cfg.label} · ${t.model} — ${tr('соединение {ms} мс', { ms: Date.now() - t0 })}${t.isLocal ? ` · ${tr('локально')}` : ''}`
      )
    } catch (e) {
      const err = toAppError(e)
      add(`role:${role}`, roleLabel(role), false, `${t.cfg.label}: ${err.message}${err.detail ? ` (${err.detail})` : ''}`)
    }
  }

  add(
    'shortcuts',
    t('Горячие клавиши'),
    d.shortcutConflicts.length === 0,
    d.shortcutConflicts.length ? t('Конфликты: {list}', { list: d.shortcutConflicts.join('; ') }) : t('Все сочетания зарегистрированы, конфликтов нет')
  )
  add(
    'protection',
    t('Защита окна подсказок от захвата'),
    d.protectionSupported ? null : false,
    d.protectionSupported
      ? t(
          'Системный флаг {flag} доступен. Результат зависит от способа захвата — проверьте у получателя: начните демонстрацию экрана и попросите собеседника сказать, видно ли окно подсказок.',
          { flag: process.platform === 'darwin' ? 'NSWindowSharingNone' : 'WDA_EXCLUDEFROMCAPTURE' }
        )
      : t('Нужна Windows 10 2004 или новее, либо macOS')
  )

  if (d.settings.offline) {
    try {
      await d.guard.fetch('https://example.com/')
      add('offline', t('Офлайн-режим'), false, t('Внешний запрос НЕ заблокирован'))
    } catch {
      add('offline', t('Офлайн-режим'), true, t('Внешние адреса заблокированы на уровне приложения'))
    }
  } else add('offline', t('Офлайн-режим'), null, t('Выключен: разрешены запросы к выбранным провайдерам'))

  add(
    'ocr',
    t('Локальный OCR'),
    d.ocr.installed() ? true : null,
    d.ocr.installed() ? t('Установлен (eng, rus, ukr)') : t('Не установлен — нужен только для моделей без vision')
  )

  const integrity = (d.db.sql.prepare('PRAGMA quick_check').get() as Record<string, string>)?.quick_check
  add('db', t('Локальная база'), integrity === 'ok', integrity === 'ok' ? t('Целостность в порядке') : t('Проблема: {detail}', { detail: integrity }))

  return { at: Date.now(), checks }
}
