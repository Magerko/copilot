import { useState } from 'react'
import { api } from '../lib/api'
import { useAsync } from '../lib/hooks'
import { Markdown } from '../lib/md'
import { fmtDate } from './ui'

export function History() {
  const [q, setQ] = useState('')
  const [list, reload] = useAsync(() => api.history.list(q), [q])
  const [open, setOpen] = useState<string | null>(null)
  const [detail] = useAsync(() => (open ? api.history.get(open) : Promise.resolve(null)), [open])
  const [msg, setMsg] = useState<string | null>(null)
  const [confirmAll, setConfirmAll] = useState(false)

  const remove = async (id: string) => {
    await api.history.remove(id)
    if (open === id) setOpen(null)
    reload()
  }

  return (
    <div className="page col" style={{ gap: 16 }}>
      <div className="row between">
        <h1>История</h1>
        <div className="row">
          {confirmAll ? (
            <>
              <span className="small">Удалить все сессии, транскрипты и журнал без возможности восстановления?</span>
              <button
                className="btn danger sm"
                onClick={async () => {
                  await api.history.removeAll()
                  setConfirmAll(false)
                  setOpen(null)
                  reload()
                  setMsg('Вся история удалена с этого компьютера.')
                }}
              >
                Да, удалить всё
              </button>
              <button className="btn sm ghost" onClick={() => setConfirmAll(false)}>
                Отмена
              </button>
            </>
          ) : (
            <button className="btn danger sm" onClick={() => setConfirmAll(true)}>
              Удалить всё
            </button>
          )}
        </div>
      </div>
      {msg && <div className="banner ok small">{msg}</div>}
      <input className="input" placeholder="Поиск по названию и транскрипту" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="hist">
        <div className="card col hist-list scroll" style={{ gap: 2, padding: 8 }}>
          {list?.map((s) => (
            <button key={s.id} className={`hist-item ${open === s.id ? 'on' : ''}`} onClick={() => setOpen(s.id)}>
              <span className="small faint">{fmtDate(s.startedAt)}</span>
              <span className="grow ellipsis">{s.title}</span>
              <span className="small muted">{s.questions}</span>
              {s.status === 'interrupted' && <span className="chip">прервана</span>}
            </button>
          ))}
          {list && !list.length && (
            <div className="muted small" style={{ padding: 10 }}>
              Ничего не найдено
            </div>
          )}
        </div>
        <div className="card col scroll hist-detail">
          {!detail ? (
            <div className="muted">Выберите сессию слева.</div>
          ) : (
            <>
              <div className="row between">
                <h2>{String(detail.session?.title ?? '')}</h2>
                <div className="row">
                  <button className="btn sm" onClick={async () => setMsg((await api.history.export(open!, 'md')) ? 'Экспортировано в Markdown' : null)}>
                    Экспорт .md
                  </button>
                  <button className="btn sm" onClick={async () => setMsg((await api.history.export(open!, 'json')) ? 'Экспортировано в JSON' : null)}>
                    .json
                  </button>
                  <button className="btn sm danger" onClick={() => void remove(open!)}>
                    Удалить
                  </button>
                </div>
              </div>
              {[...new Map(detail.questions.map((x) => [String(x.id), x])).values()].map((qq) => (
                <div key={String(qq.id)} className="col" style={{ gap: 4 }}>
                  <h3>{String(qq.text)}</h3>
                  {detail.answers
                    .filter((x) => x.question_id === qq.id && x.status === 'done')
                    .map((x) => (
                      <div key={String(x.id)} className="small">
                        <span className="chip">{String(x.kind)}</span> <span className="faint">{String(x.model)}</span>
                        <Markdown text={String(x.text)} />
                      </div>
                    ))}
                </div>
              ))}
              <h3 className="muted">Транскрипт</h3>
              <div className="col small" style={{ gap: 3 }}>
                {detail.segments.map((s) => (
                  <div key={String(s.id)}>
                    <b>{s.source === 'remote' ? 'Собеседник' : 'Я'}:</b> {String(s.text)}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
