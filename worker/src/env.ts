import type { Help } from '../../src/tutor/turn'

export interface Env {
  ANTHROPIC_API_KEY: string
  MODEL: string
  /** Workers AI model used when ANTHROPIC_API_KEY is not set. */
  FALLBACK_MODEL?: string
  DAILY_TURN_CAP: string
  DAILY_IP_CAP: string
  /** Spoken turns have their own cap: a transcription is cheaper than a model turn. */
  DAILY_STT_CAP?: string
  /** The natural voice on Workers AI; "{lang}" becomes en or es. See tts.ts. */
  TTS_MODEL?: string
  /** The cheap voice that takes over once the day's premium clips are spent. */
  TTS_BUDGET_MODEL?: string
  /** How many clips a day, across everyone, the natural voice may read. */
  DAILY_TTS_PREMIUM?: string
  /** Optional speaker names for the natural voice, per language. */
  TTS_SPEAKER_EN?: string
  TTS_SPEAKER_ES?: string
  /** Replies read aloud per device per day. */
  DAILY_TTS_CAP?: string
  ALLOWED_ORIGIN: string
  DB: D1Database
  /** The Workers AI binding: speech-to-text, and the partner when there is no key. */
  AI?: Ai
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

// The Chicago calendar day before today(), as YYYY-MM-DD. Computed from the
// formatted date rather than "now minus 24 hours", which is off by a day around
// the DST switch. Counters older than this are pruned; see caps.ts.
export function yesterday(): string {
  const [y, m, d] = today().split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d) - 86400000).toISOString().slice(0, 10)
}

// The one loose cast onto the Workers AI binding. The binding's generated model
// types change between workers-types releases, and we make four calls in all
// (Whisper, the partner, Table-mode help, the voice), so each caller types its own result.
export function runAi(ai: Ai, model: string, input: unknown): Promise<unknown> {
  const run = (ai as unknown as { run: (model: string, input: unknown) => Promise<unknown> }).run
  return run.call(ai, model, input)
}

// Every log line is one JSON object of counts, names and flags. Never learner
// text, never a model reply, never an error message (an SDK error's message can
// carry the upstream body, and a parse error can carry a fragment of the input).
export function log(fields: Record<string, unknown>): void {
  console.log(JSON.stringify(fields))
}

export function errName(err: unknown): string {
  return err instanceof Error ? err.name : 'error'
}

/** What /api/help returns when it cannot answer; Table mode shows its "unavailable" string. */
export const NO_HELP: Help = { phrase: '', literal: '', tip: '' }
