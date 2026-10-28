const known = new Set<string>()

const PATTERNS: RegExp[] = [
  /sk-(ant-|proj-)?[A-Za-z0-9_-]{16,}/g,
  /AIza[0-9A-Za-z_-]{30,}/g,
  /(Bearer|x-api-key[:=]|x-goog-api-key[:=])\s*[A-Za-z0-9._-]{12,}/gi,
  /([?&](key|api_key|token)=)[^&\s]+/gi
]

export function registerSecret(value: string): void {
  if (value.length >= 8) known.add(value)
}

export function unregisterSecret(value: string): void {
  known.delete(value)
}

/** I apply this to everything that leaves the process as text: logs, diagnostics, exports, error details. */
export function redact(text: string): string {
  let out = text
  for (const s of known) out = out.split(s).join('[secret]')
  for (const p of PATTERNS) out = out.replace(p, (_m, pre?: string) => (typeof pre === 'string' && pre.endsWith('=') ? `${pre}[secret]` : '[secret]'))
  return out
}

export function redactDeep<T>(value: T): T {
  return JSON.parse(redact(JSON.stringify(value))) as T
}
