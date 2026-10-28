export interface Chunk {
  id: string
  documentId: string
  docName: string
  kind: 'cv' | 'jd' | 'notes'
  section: string
  text: string
}

const HEADING = /^(#{1,6}\s+.+|[A-ZА-ЯІЇЄҐ][A-ZА-ЯІЇЄҐ0-9 &/,-]{2,60}:?|.{2,60}:)$/u

/** Splits on headings and blank lines into ~maxChars pieces, keeping the nearest heading as the section label. */
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
      // Prefer a break at whitespace; a run without any (minified text, long URLs) is cut hard so nothing is lost.
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

/** Cheap stemmer: prefix truncation is enough for BM25 over RU/UA morphology on a few pages of CV. */
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
