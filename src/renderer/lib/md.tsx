import { Fragment, type ReactNode } from 'react'

/** Minimal markdown → React (no HTML injection path): headings, lists, fenced code, inline code, bold. */
export function Markdown({ text }: { text: string }) {
  const blocks: ReactNode[] = []
  const lines = text.replace(/\r/g, '').split('\n')
  let i = 0
  let key = 0
  while (i < lines.length) {
    const line = lines[i]
    if (/^```/.test(line)) {
      const body: string[] = []
      i++
      while (i < lines.length && !/^```/.test(lines[i])) body.push(lines[i++])
      i++
      blocks.push(<pre key={key++}>{body.join('\n')}</pre>)
      continue
    }
    if (/^#{1,6}\s/.test(line)) {
      blocks.push(<h4 key={key++}>{inline(line.replace(/^#+\s*/, ''))}</h4>)
      i++
      continue
    }
    if (/^\s*([-*•]|\d+[.)])\s+/.test(line)) {
      const items: string[] = []
      while (i < lines.length && /^\s*([-*•]|\d+[.)])\s+/.test(lines[i])) items.push(lines[i++].replace(/^\s*([-*•]|\d+[.)])\s+/, ''))
      blocks.push(
        <ul key={key++}>
          {items.map((it, j) => (
            <li key={j}>{inline(it)}</li>
          ))}
        </ul>
      )
      continue
    }
    if (!line.trim()) {
      i++
      continue
    }
    const para: string[] = []
    while (i < lines.length && lines[i].trim() && !/^(```|#{1,6}\s|\s*([-*•]|\d+[.)])\s+)/.test(lines[i])) para.push(lines[i++])
    blocks.push(<p key={key++}>{inline(para.join(' '))}</p>)
  }
  return <div className="md">{blocks}</div>
}

/** Inline-only markdown (bold, code) for one-line answers and bullets that must not become blocks. */
export function MarkdownInline({ text }: { text: string }) {
  return <>{inline(text)}</>
}

function inline(s: string): ReactNode {
  // While an answer streams, a «**» can arrive before its pair; I hide the dangling one instead of flashing raw asterisks.
  if ((s.match(/\*\*/g)?.length ?? 0) % 2) s = s.replace(/\*\*(?!.*\*\*)/s, '')
  const parts = s.split(/(`[^`]+`|\*\*[^*]+\*\*)/g)
  return parts.map((p, i) =>
    p.startsWith('`') && p.endsWith('`') && p.length > 1 ? (
      <code key={i}>{p.slice(1, -1)}</code>
    ) : p.startsWith('**') && p.endsWith('**') && p.length > 4 ? (
      <strong key={i}>{p.slice(2, -2)}</strong>
    ) : (
      <Fragment key={i}>{p}</Fragment>
    )
  )
}
