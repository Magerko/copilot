import { useEffect, useState } from 'react'
import type { KnowledgeDoc, Profile } from '@shared/types'
import { api } from '../lib/api'
import { useAsync } from '../lib/hooks'
import type { Ctx } from './App'
import { ErrorText } from './ui'

export const PRESET_LABEL: Record<Profile['preset'], string> = {
  hr: 'HR / поведенческое',
  backend: 'Backend',
  frontend: 'Frontend',
  devops: 'DevOps / SRE',
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
        <h1>Профиль и документы</h1>
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
              const p = await api.profiles.upsert({ id: '', name: 'Новый профиль', preset: 'backend', style: 'natural', notes: '' })
              await ctx.patch({ activeProfileId: p.id })
              reload()
            }}
          >
            + Профиль
          </button>
        </div>
      </div>

      <section className="card col">
        <div className="grid2">
          <label className="field">
            <span>Название (например, «Яндекс — Senior Backend»)</span>
            <input className="input" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
          </label>
          <label className="field">
            <span>Тип интервью</span>
            <select className="input" value={draft.preset} onChange={(e) => setDraft({ ...draft, preset: e.target.value as Profile['preset'] })}>
              {Object.entries(PRESET_LABEL).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Стиль подачи</span>
            <select className="input" value={draft.style} onChange={(e) => setDraft({ ...draft, style: e.target.value as Profile['style'] })}>
              {Object.entries(STYLE_LABEL).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Язык ответов</span>
            <select className="input" value={ctx.settings.answerLang} onChange={(e) => void ctx.patch({ answerLang: e.target.value as 'auto' })}>
              <option value="auto">Как в вопросе</option>
              <option value="ru">Русский</option>
              <option value="uk">Українська</option>
              <option value="en">English</option>
            </select>
          </label>
        </div>
        <label className="field">
          <span>Заметки о себе и проектах (попадают в контекст как факты, которые вы подтверждаете)</span>
          <textarea
            className="input"
            value={draft.notes}
            onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
            placeholder="Например: стек — Python/FastAPI, проект X: ускорил отчёты в 3 раза…"
          />
        </label>
        <div className="row">
          <button className="btn primary" onClick={() => void save()}>
            Сохранить
          </button>
          {saved && <span className="small muted">Сохранено</span>}
          <span className="grow" />
          {profiles.length > 1 && (
            <button
              className="btn danger sm"
              onClick={async () => {
                await api.profiles.remove(draft.id)
                reload()
              }}
            >
              Удалить профиль
            </button>
          )}
        </div>
      </section>

      <section className="card col">
        <div className="row between">
          <h2>Документы профиля</h2>
          <div className="row">
            {(['cv', 'jd', 'notes'] as const).map((k) => (
              <button key={k} className="btn sm" onClick={() => void importDoc(k)}>
                + {KIND_LABEL[k]} (файл)
              </button>
            ))}
            <button className="btn sm ghost" onClick={() => setPaste({ kind: 'jd', text: '' })}>
              Вставить текст
            </button>
          </div>
        </div>
        <div className="small muted">
          PDF, DOCX, TXT, MD. Текст извлекается и индексируется на этом компьютере. В ответ попадают только подходящие к вопросу фрагменты.
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
                    {KIND_LABEL[k]}
                  </option>
                ))}
              </select>
            </div>
            <textarea
              className="input"
              style={{ minHeight: 160 }}
              value={paste.text}
              onChange={(e) => setPaste({ ...paste, text: e.target.value })}
              placeholder="Вставьте текст вакансии или резюме"
            />
            <div className="row">
              <button
                className="btn primary sm"
                disabled={!paste.text.trim()}
                onClick={async () => {
                  await api.knowledge.addText(draft.id, paste.kind, `${KIND_LABEL[paste.kind]} (вставка)`, paste.text)
                  setPaste(null)
                  reloadDocs()
                }}
              >
                Добавить
              </button>
              <button className="btn sm ghost" onClick={() => setPaste(null)}>
                Отмена
              </button>
            </div>
          </div>
        )}
        {docs?.length ? (
          <div className="col" style={{ gap: 4 }}>
            {docs.map((d) => (
              <div key={d.id} className="row small doc-row">
                <span className="chip">{KIND_LABEL[d.kind]}</span>
                <span className="grow">{d.name}</span>
                <span className="faint">{d.chunks} фрагм.</span>
                <button
                  className="btn ghost sm danger"
                  onClick={async () => {
                    await api.knowledge.remove(d.id)
                    reloadDocs()
                  }}
                >
                  Удалить
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="banner small">Документов нет. Без резюме ответы будут общими — личный опыт не будет придумываться.</div>
        )}
      </section>
    </div>
  )
}
