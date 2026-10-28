export interface SseEvent {
  event: string | null
  data: string
}

export async function* readSse(body: ReadableStream<Uint8Array>, signal?: AbortSignal): AsyncGenerator<SseEvent> {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buf = ''
  let event: string | null = null
  let data: string[] = []
  try {
    while (true) {
      if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')
      const { value, done } = await reader.read()
      if (done) break
      buf += decoder.decode(value, { stream: true })
      let nl: number
      while ((nl = buf.indexOf('\n')) >= 0) {
        let line = buf.slice(0, nl)
        buf = buf.slice(nl + 1)
        if (line.endsWith('\r')) line = line.slice(0, -1)
        if (line === '') {
          if (data.length) yield { event, data: data.join('\n') }
          event = null
          data = []
          continue
        }
        if (line.startsWith(':')) continue
        const idx = line.indexOf(':')
        const field = idx < 0 ? line : line.slice(0, idx)
        const val = idx < 0 ? '' : line.slice(idx + 1).replace(/^ /, '')
        if (field === 'data') data.push(val)
        else if (field === 'event') event = val
      }
    }
    if (data.length) yield { event, data: data.join('\n') }
  } finally {
    reader.releaseLock()
    body.cancel().catch(() => {})
  }
}
