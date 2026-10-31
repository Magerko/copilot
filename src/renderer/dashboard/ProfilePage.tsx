import { useEffect, useState } from 'react'
import type { KnowledgeDoc, Profile } from '@shared/types'
import { api } from '../lib/api'
import { useAsync } from '../lib/hooks'
import { t } from '../lib/i18n'
import type { Ctx } from './App'
import { ErrorText } from './ui'

// Russian keys: these maps are built before the window sets its language, so callers pass the value through t().
export const PRESET_LABEL: Record<Profile['preset'], string> = {
  hr: 'HR / поведенческое',
  backend: 'Backend',
  frontend: 'Frontend',
  devops: 'DevOps / SRE',
  qa: 'QA / тестирование',
  system_design: 'System Design',
  coding: 'Coding-интервью',
  meeting: 'Рабочая встреча'
}

export const STYLE_LABEL: Record<Profile['style'], string> = {
  short: 'Максимально коротко',
  natural: 'Естественно',
  academic: 'Академично',
  english_b2: 'На английском B2'
}

const KIND_LABEL: Record<KnowledgeDoc['kind'], string> = { cv: 'Резюме', jd: 'Вакансия', notes: 'Заметки' }

export function ProfilePage({ ctx }: { ctx: Ctx }) {
  const [profiles, reload] = useAsync(() => api.profiles.list(), [])
  const active = profiles?.find((p) => p.id === ctx.settings.activeProfileId) ?? profiles?.[0]
  const [draft, setDraft] = useState<Profile | null>(null)
  const [docs, reloadDocs] = useAsync(() => (active ? api.knowledge.list(active.id) : Promise.resolve([])), [active?.id])
  const [err, setErr] = useState<string | null>(null)
  const [paste, setPaste] = useState<{ kind: KnowledgeDoc['kind']; text: string } | null>(null)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (active) setDraft(active)
  }, [active])

  if (!profiles || !draft) return null

  const save = async () => {
    await api.profiles.upsert(draft)
    setSaved(true)
    setTimeout(() => setSaved(false), 1500)
    reload()
  }

  const importDoc = async (kind: KnowledgeDoc['kind']) => {
    setErr(null)
    try {
      await api.knowledge.import(draft.id, kind)
      reloadDocs()
    } catch (e) {
      setErr((e as Error).message)
    }
  }

  return (
    <div className="page col" style={{ gap: 16 }}>
      <div className="row between">
        <h1>{t('Профиль и документы')}</h1>
        <div className="row">
          <select className="input" style={{ width: 220 }} value={draft.id} onChange={(e) => void ctx.patch({ activeProfileId: e.target.value })}>
            {profiles.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <button
            className="btn"
            onClick={async () => {
              const p = await api.profiles.upsert({ id: '', name: t('Новый профиль'), preset: 'backend', style: 'natural', notes: '' })
              await ctx.patch({ activeProfileId: p.id })
              reload()
            }}
          >
            + {t('Профиль')}
          </button>
        </div>
      </div>

      <section className="card col">
        <div className="grid2">
          <label className="field">
            <span>{t('Название (например, «Яндекс — Senior Backend»)')}</span>
            <input className="input" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
          </label>
          <label className="field">
            <span>{t('Тип интервью')}</span>
            <select className="input" value={draft.preset} onChange={(e) => setDraft({ ...draft, preset: e.target.value as Profile['preset'] })}>
              {Object.entries(PRESET_LABEL).map(([k, v]) => (
                <option key={k} value={k}>
                  {t(v)}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>{t('Стиль подачи')}</span>
            <select className="input" value={draft.style} onChange={(e) => setDraft({ ...draft, style: e.target.value as Profile['style'] })}>
              {Object.entries(STYLE_LABEL).map(([k, v]) => (
                <option key={k} value={k}>
                  {t(v)}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>{t('Язык ответов')}</span>
            <select className="input" value={ctx.settings.answerLang} onChange={(e) => void ctx.patch({ answerLang: e.target.value as 'auto' })}>
              <option value="auto">{t('Как в вопросе')}</option>
              <option value="ru">Русский</option>
              <option value="uk">Українська</option>
              <option value="en">English</option>
            </select>
          </label>
        </div>
        <label className="field">
          <span>{t('Заметки о себе и проектах (попадают в контекст как факты, которые вы подтверждаете)')}</span>
          <textarea
            className="input"
            value={draft.notes}
            onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
            placeholder={t('Например: стек — Python/FastAPI, проект X: ускорил отчёты в 3 раза…')}
          />
        </label>
        <div className="row">
          <button className="btn primary" onClick={() => void save()}>
            {t('Сохранить')}
          </button>
          {saved && <span className="small muted">{t('Сохранено')}</span>}
          <span className="grow" />
          {profiles.length > 1 && (
            <button
              className="btn danger sm"
              onClick={async () => {
                await api.profiles.remove(draft.id)
                reload()
              }}
            >
              {t('Удалить профиль')}
            </button>
          )}
        </div>
      </section>

      <section className="card col">
        <div className="row between">
          <h2>{t('Документы профиля')}</h2>
          <div className="row">
            {(['cv', 'jd', 'notes'] as const).map((k) => (
              <button key={k} className="btn sm" onClick={() => void importDoc(k)}>
                + {t('{kind} (файл)', { kind: t(KIND_LABEL[k]) })}
              </button>
            ))}
            <button className="btn sm ghost" onClick={() => setPaste({ kind: 'jd', text: '' })}>
              {t('Вставить текст')}
            </button>
          </div>
        </div>
        <div className="small muted">
          {t('PDF, DOCX, TXT, MD. Текст извлекается и индексируется на этом компьютере. В ответ попадают только подходящие к вопросу фрагменты.')}
        </div>
        <ErrorText text={err} />
        {paste && (
          <div className="col">
            <div className="row">
              <select
                className="input"
                style={{ width: 160 }}
                value={paste.kind}
                onChange={(e) => setPaste({ ...paste, kind: e.target.value as KnowledgeDoc['kind'] })}
              >
                {(['cv', 'jd', 'notes'] as const).map((k) => (
                  <option key={k} value={k}>
                    {t(KIND_LABEL[k])}
                  </option>
                ))}
              </select>
            </div>
            <textarea
              className="input"
              style={{ minHeight: 160 }}
              value={paste.text}
              onChange={(e) => setPaste({ ...paste, text: e.target.value })}
              placeholder={t('Вставьте текст вакансии или резюме')}
            />
            <div className="row">
              <button
                className="btn primary sm"
                disabled={!paste.text.trim()}
                onClick={async () => {
                  await api.knowledge.addText(draft.id, paste.kind, t('{kind} (вставка)', { kind: t(KIND_LABEL[paste.kind]) }), paste.text)
                  setPaste(null)
                  reloadDocs()
                }}
              >
                {t('Добавить')}
              </button>
              <button className="btn sm ghost" onClick={() => setPaste(null)}>
                {t('Отмена')}
              </button>
            </div>
          </div>
        )}
        {docs?.length ? (
          <div className="col" style={{ gap: 4 }}>
            {docs.map((d) => (
              <div key={d.id} className="row small doc-row">
                <span className="chip">{t(KIND_LABEL[d.kind])}</span>
                <span className="grow">{d.name}</span>
                <span className="faint">{t('{n} фрагм.', { n: d.chunks })}</span>
                <button
                  className="btn ghost sm danger"
                  onClick={async () => {
                    await api.knowledge.remove(d.id)
                    reloadDocs()
                  }}
                >
                  {t('Удалить')}
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="banner small">{t('Документов нет. Без резюме ответы будут общими — личный опыт не будет придумываться.')}</div>
        )}
      </section>
    </div>
  )
}
