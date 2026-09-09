export interface Env {
  ANTHROPIC_API_KEY: string
  MODEL: string
  DAILY_TURN_CAP: string
  DAILY_IP_CAP: string
  ALLOWED_ORIGIN: string
  DB: D1Database
  CAPS: KVNamespace
}

export function json(body: unknown, status = 200, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', ...extra },
  })
}

export async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

// The day boundary is Chicago's, not UTC's. On UTC the daily cap would reset at
// 7pm local, in the middle of the evening practice window, handing a learner two
// allowances in one evening and none the next afternoon.
const DAY_FMT = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Chicago' })

export function today(): string {
  return DAY_FMT.format(new Date())
}
