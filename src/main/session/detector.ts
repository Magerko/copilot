import type { UtteranceKind } from '@shared/types'

export interface Classification {
  kind: UtteranceKind
  /** high ⇒ may auto-trigger; low ⇒ shown as «Возможный вопрос» only. */
  confidence: 'high' | 'low'
}

const SMALL_TALK = [
  /\b(how are you|can you hear me|hear me ok|nice to meet|thank(s| you)|good (morning|afternoon|evening)|hello|hi there)\b/,
  /(как (дела|вы|ты)(?!\p{L})|меня слышно|слышите меня|приятно познакомиться|спасибо|добрый (день|вечер)|доброе утро|привет|здравствуйте)/u,
  /(як (справи|ви)(?!\p{L})|мене чути|чуєте мене|приємно познайомитися|дякую|добрий (день|вечір)|доброго ранку|привіт|вітаю)/u
]

const FOLLOW_UP = [
  /^(and |so |but )?(why|what about|what if|how so|for example|such as|can you elaborate|elaborate|go deeper|tell me more|more details|in what way)\b/,
  /^(а |и |но )?(почему|зачем|что если|а если|например|подробнее|можно подробнее|раскройте|раскрой|поясните|в каком смысле|а как|а что)(?!\p{L})/u,
  /^(а |і |але )?(чому|навіщо|що якщо|а якщо|наприклад|детальніше|можна детальніше|розкрийте|поясніть|в якому сенсі|а як|а що)(?!\p{L})/u
]

const CODING = [
  /\b(write (a|the) (function|method|class|query|program)|implement|leetcode|algorithm|time complexity|space complexity|big o|refactor|debug this|reverse a|binary tree|linked list)\b/,
  /(напишите|напиши|реализуйте|реализуй) (функцию|метод|класс|запрос|алгоритм|код)|алгоритм|сложность (по времени|алгоритма)|асимптотик|связный список|бинарное дерево/,
  /(напишіть|напиши|реалізуйте|реалізуй) (функцію|метод|клас|запит|алгоритм|код)|алгоритм|складність|зв'язаний список|бінарне дерево/
]

const SCREEN = [
  /\b(on (the|my|your) screen|i('m| am) sharing|this code|look at (this|the code)|in this snippet|what does this (code|function) do)\b/,
  /(на экране|я расшарил|посмотрите на (код|экран)|этот код|в этом фрагменте|что делает (этот|эта) )/,
  /(на екрані|подивіться на (код|екран)|цей код|у цьому фрагменті|що робить (цей|ця) )/
]

const LEAD_EN =
  /^(what|why|how|when|where|which|who|whom|whose|is|are|do|does|did|can|could|would|will|should|have|has|tell me|explain|describe|walk me through|give me|share|talk about|compare|define)\b/
const LEAD_RU =
  /^(что|чем|почему|зачем|как|когда|где|куда|откуда|какой|какая|какое|какие|каким|каких|кто|кого|сколько|расскажите|расскажи|объясните|объясни|опишите|опиши|приведите|приведи|поделитесь|сравните|можете|можешь|могли бы|есть ли|был ли|была ли|были ли|назовите|чего)(?!\p{L})/u
const LEAD_UK =
  /^(що|чим|чому|навіщо|як|коли|де|куди|звідки|який|яка|яке|які|яким|яких|хто|кого|скільки|розкажіть|розкажи|поясніть|поясни|опишіть|опиши|наведіть|наведи|поділіться|порівняйте|можете|можеш|чи|назвіть)(?!\p{L})/u
const EMBEDDED_ASK =
  /\b(i('d| would) like to (know|hear)|i('m| am) curious|tell us)\b|(хотел(ось)? бы (узнать|услышать)|интересно,? (как|что|почему))|(хотів би (дізнатися|почути)|цікаво,? (як|що|чому))/

export function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[«»"“”„]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function words(text: string): number {
  return text.split(/\s+/).filter(Boolean).length
}

export function classify(raw: string): Classification {
  const t = normalize(raw)
  const n = words(t)
  if (n === 0) return { kind: 'unknown', confidence: 'low' }
  const endsQ = /\?\s*$/.test(t)
  const stripped = t.replace(/^(ok(ay)?|so|well|alright|хорошо|ладно|итак|так|окей|добре|гаразд|отже)[, ]+/, '')
  if (n <= 8 && SMALL_TALK.some((r) => r.test(stripped))) return { kind: 'small_talk', confidence: 'high' }
  if (FOLLOW_UP.some((r) => r.test(stripped))) return { kind: 'follow_up', confidence: endsQ || n >= 2 ? 'high' : 'low' }
  if (SCREEN.some((r) => r.test(stripped))) return { kind: 'screen_reference', confidence: 'high' }
  if (CODING.some((r) => r.test(stripped))) return { kind: 'coding_task', confidence: 'high' }

  const lead = LEAD_EN.test(stripped) || LEAD_RU.test(stripped) || LEAD_UK.test(stripped)
  // Russian «ли» as the second word marks a yes/no question without «?» from ASR.
  const liParticle = /^\S+ ли(?!\p{L})/u.test(stripped)
  if (endsQ && n >= 3) return { kind: 'question', confidence: 'high' }
  if ((lead || liParticle) && n >= 4) return { kind: 'question', confidence: 'high' }
  if (EMBEDDED_ASK.test(stripped) && n >= 5) return { kind: 'question', confidence: 'high' }
  if (endsQ || lead || liParticle) return { kind: 'question', confidence: 'low' }
  if (n < 3) return { kind: 'unknown', confidence: 'low' }
  return { kind: 'statement', confidence: 'high' }
}

export function isExpandRequest(raw: string): boolean {
  const t = normalize(raw)
  return /\b(repeat|say (it|that) again|more detail|elaborate|expand)\b|(повтори|раскрой|подробнее|разверни)|(повтори|розкрий|детальніше|розгорни)/.test(t)
}

/** Character-trigram Dice coefficient: robust to ASR word-boundary noise and morphology. */
export function similarity(a: string, b: string): number {
  const ga = trigrams(normalize(a))
  const gb = trigrams(normalize(b))
  if (!ga.size || !gb.size) return 0
  let inter = 0
  for (const [g, c] of ga) inter += Math.min(c, gb.get(g) ?? 0)
  let total = 0
  for (const c of ga.values()) total += c
  for (const c of gb.values()) total += c
  return (2 * inter) / total
}

function trigrams(s: string): Map<string, number> {
  const clean = ` ${s.replace(/[^\p{L}\p{N} ]/gu, '')} `
  const m = new Map<string, number>()
  for (let i = 0; i + 3 <= clean.length; i++) {
    const g = clean.slice(i, i + 3)
    m.set(g, (m.get(g) ?? 0) + 1)
  }
  return m
}
