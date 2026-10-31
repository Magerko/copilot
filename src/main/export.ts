import { redact } from './storage/redact'
import { getLang, t } from '@shared/i18n'

type Row = Record<string, unknown>

const KIND: Record<string, string> = { say: 'Say it', points: 'Тезисы', deep: 'Подробно', screen: 'Экран' }

function ts(ms: unknown): string {
  const n = Number(ms ?? 0)
  const m = Math.floor(n / 60000)
  const sec = Math.floor((n % 60000) / 1000)
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
}

export function exportSession(d: { session: Row | undefined; segments: Row[]; questions: Row[]; answers: Row[] }, fmt: 'md' | 'json'): string {
  if (!d.session) throw new Error(t('Сессия не найдена'))
  if (fmt === 'json') return redact(JSON.stringify({ format: 'copilot/session@1', ...d }, null, 2))

  const latest = new Map<string, Row>()
  for (const q of d.questions) latest.set(String(q.id), q)
  const locale = { ru: 'ru-RU', uk: 'uk-UA', en: 'en-US' }[getLang()]
  const lines: string[] = [
    `# ${d.session.title ?? t('Сессия')}`,
    '',
    t('Начало: {date}', { date: new Date(Number(d.session.started_at)).toLocaleString(locale) }),
    ''
  ]
  lines.push(`## ${t('Вопросы и ответы')}`, '')
  for (const q of latest.values()) {
    lines.push(`### ${ts(q.start_ms)} — ${q.text}`, '')
    for (const a of d.answers.filter((x) => x.question_id === q.id && x.status === 'done')) {
      lines.push(
        `**${KIND[String(a.kind)] ? t(KIND[String(a.kind)]) : a.kind}** · ${a.provider}/${a.model}${a.first_token_ms ? ` · ${t('{ms} мс', { ms: Number(a.first_token_ms) })}` : ''}`,
        '',
        String(a.text),
        ''
      )
    }
  }
  lines.push(`## ${t('Транскрипт')}`, '')
  for (const s of d.segments) lines.push(`- \`${ts(s.start_ms)}\` **${s.source === 'remote' ? t('Собеседник') : t('Я')}:** ${s.text}`)
  return redact(lines.join('\n'))
}
