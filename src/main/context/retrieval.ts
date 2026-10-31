export interface Chunk {
  id: string
  documentId: string
  docName: string
  kind: 'cv' | 'jd' | 'notes'
  section: string
  text: string
}

const HEADING = /^(#{1,6}\s+.+|[A-ZА-ЯІЇЄҐ][A-ZА-ЯІЇЄҐ0-9 &/,-]{2,60}:?|.{2,60}:)$/u

/** I split on headings and blank lines into ~maxChars pieces, keeping the nearest heading as the section label. */
export function chunkText(text: string, maxChars = 700): { section: string; text: string }[] {
  const out: { section: string; text: string }[] = []
  let section = ''
  let buf: string[] = []
  const flush = () => {
    const t = buf.join('\n').trim()
    if (t) out.push({ section, text: t })
    buf = []
  }
  for (const raw of text.replace(/\r/g, '').split('\n')) {
    const line = raw.trimEnd()
    const trimmed = line.trim()
    if (trimmed && trimmed.length <= 60 && HEADING.test(trimmed) && !/[.!?]$/.test(trimmed)) {
      flush()
      section = trimmed.replace(/^#+\s*/, '').replace(/:$/, '')
      continue
    }
    if (!trimmed) {
      if (buf.join('\n').length > maxChars / 2) flush()
      continue
    }
    if (buf.join('\n').length + line.length > maxChars) flush()
    if (line.length > maxChars) {
      // I prefer a break at whitespace; a run without any (minified text, long URLs) I cut hard so nothing is lost.
      for (const piece of line.match(new RegExp(`.{1,${maxChars}}(\\s|$)|.{${maxChars}}`, 'gs')) ?? [line]) {
        buf.push(piece)
        flush()
      }
      continue
    }
    buf.push(line)
  }
  flush()
  return out
}

const STOP = new Set(
  'the a an and or of to in on for with is are was were be been it this that you your i my me we our what how why when where which who do does did can could would should about tell me и в во на с со по к ко из за от до для о об что как это этот эта вы ваш ваши я мой мне мы наш ли ли не да но а или же бы то так расскажите расскажи опишите і та у в на з із до для про що як це цей ця ви ваш я мій мені ми наш чи не так розкажіть опыт опыта опытом experience досвід досвіду работы работа роботи робота'.split(
    ' '
  )
)

/** Cheap stemmer: I rely on prefix truncation — enough for BM25 over RU/UA morphology on a few pages of CV. */
export function tokenize(text: string): string[] {
  return (text.toLowerCase().match(/[\p{L}\p{N}+#.]+/gu) ?? [])
    .map((w) => w.replace(/^\.+|\.+$/g, ''))
    .filter((w) => w.length > 1 && !STOP.has(w))
    .map((w) => (w.length > 6 && /\p{Script=Cyrillic}/u.test(w) ? w.slice(0, 6) : w.length > 8 ? w.slice(0, 8) : w))
}

export class Bm25Index {
  private docs: { chunk: Chunk; tf: Map<string, number>; len: number }[] = []
  private df = new Map<string, number>()
  private avgLen = 0

  constructor(chunks: Chunk[]) {
    for (const chunk of chunks) {
      const toks = tokenize(`${chunk.section} ${chunk.text}`)
      const tf = new Map<string, number>()
      for (const t of toks) tf.set(t, (tf.get(t) ?? 0) + 1)
      for (const t of tf.keys()) this.df.set(t, (this.df.get(t) ?? 0) + 1)
      this.docs.push({ chunk, tf, len: toks.length })
    }
    this.avgLen = this.docs.reduce((n, d) => n + d.len, 0) / Math.max(1, this.docs.length)
  }

  get size(): number {
    return this.docs.length
  }

  search(query: string, k: number): { chunk: Chunk; score: number }[] {
    const q = [...new Set(tokenize(query))]
    const N = this.docs.length
    const k1 = 1.2
    const b = 0.75
    return this.docs
      .map((d) => {
        let score = 0
        for (const t of q) {
          const f = d.tf.get(t)
          if (!f) continue
          const df = this.df.get(t) ?? 0
          const idf = Math.log(1 + (N - df + 0.5) / (df + 0.5))
          score += (idf * f * (k1 + 1)) / (f + k1 * (1 - b + (b * d.len) / (this.avgLen || 1)))
        }
        return { chunk: d.chunk, score }
      })
      .filter((r) => r.score > 0)
      .sort((x, y) => y.score - x.score)
      .slice(0, k)
  }
}

// Questions about the user themselves: the answer has to come from the CV even when no word matches it.
const ABOUT_ME =
  /резюме|\bcv\b|resume|досвід|опыт|о себе|про себе|yourself|experience|карьер|кар[’'`]?єр|навич|навык|skills|проект|проєкт|project|работал|працював|worked/iu
// Sections that describe the person as a whole; they go into every prompt.
const CORE_SECTION = /summary|profile|about|objective|skills|резюме|о себе|про себе|обо мне|про мене|навички|навыки|ключев|ключов/iu

/**
 * Picks the document context for one question. Lexical search misses when the CV and the question are in different
 * languages (an English CV, a Ukrainian interview), so besides the matches I always add the profile core: each CV's
 * header, summary and skills, and the start of each job description. For questions about the user, or when nothing
 * matched, the rest of the CV follows in document order. The prompt builder trims the tail to its budget, so the order
 * here is the priority: matches first, then the core, then the rest.
 */
export function selectKnowledge(index: Bm25Index | null, chunks: Chunk[], question: string, k = 8): Chunk[] {
  const out: Chunk[] = []
  const seen = new Set<string>()
  const add = (c: Chunk) => {
    if (seen.has(c.id)) return
    seen.add(c.id)
    out.push(c)
  }
  const found = index ? index.search(question, k).map((r) => r.chunk) : []
  found.forEach(add)

  const byDoc = new Map<string, Chunk[]>()
  for (const c of chunks) byDoc.set(c.documentId, [...(byDoc.get(c.documentId) ?? []), c])
  for (const doc of byDoc.values()) {
    if (doc[0].kind === 'cv') {
      add(doc[0])
      doc.filter((c) => CORE_SECTION.test(c.section)).forEach(add)
    } else if (doc[0].kind === 'jd') doc.slice(0, 2).forEach(add)
  }

  if (ABOUT_ME.test(question) || !found.length) chunks.filter((c) => c.kind === 'cv').forEach(add)
  return out
}
