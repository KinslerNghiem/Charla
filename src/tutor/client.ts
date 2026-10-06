import type { Level } from './levels'
import type { Help, TurnResponse } from './turn'
import type { Lang } from '../i18n/strings'
import type { Reports } from '../places/badges'
import { deviceId } from '../storage'

// In production the Worker can live on another origin; set VITE_API_BASE.
// In dev, vite proxies /api to wrangler on 8787 and this stays empty.
const BASE = (import.meta.env.VITE_API_BASE as string | undefined) ?? ''

// Whisper on the free tier can take a while; past this it is not coming.
const STT_TIMEOUT_MS = 15_000
// The voice normally answers in two to three seconds. Past this the device
// voice reads the line instead: late audio is worse than plainer audio.
const TTS_TIMEOUT_MS = 7_000

/** Carries the status so callers can tell "you are offline" from "that is all for today". */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

export interface HistoryItem {
  role: 'user' | 'assistant'
  content: string
}

export interface TurnRequest {
  scene_id: string
  level: Level
  learning: Lang
  history: HistoryItem[]
  user: string
  command?: 'simpler' | 'another_way'
  place_name?: string
}

export type { TurnResponse }

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(BASE + path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ ...(body as object), device: deviceId() }),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new ApiError(res.status, `${path} ${res.status} ${text}`.trim())
  }
  return (await res.json()) as T
}

export function askTutor(req: TurnRequest): Promise<TurnResponse> {
  return post<TurnResponse>('/api/turn', req)
}

export function askHelp(text: string, from: Lang, to: Lang): Promise<Help> {
  return post<Help>('/api/help', { text, from, to })
}

export interface ReportBody {
  place_id: string
  lang: Lang
  positive: boolean
  role?: string
  shift?: string
}

export function sendReport(body: ReportBody): Promise<{ ok: true; duplicate: boolean }> {
  return post<{ ok: true; duplicate: boolean }>('/api/report', body)
}

export function flagReply(scene_id: string, reply: string, reason: string): Promise<{ ok: true }> {
  return post<{ ok: true }>('/api/flag', { scene_id, reply, reason })
}

/** Posts a push-to-talk clip and returns the transcript. The clip is not kept. */
export async function transcribe(clip: Blob, lang: Lang): Promise<string> {
  const ctl = new AbortController()
  const timer = setTimeout(() => ctl.abort(), STT_TIMEOUT_MS)
  try {
    const res = await fetch(`${BASE}/api/stt?lang=${lang}`, {
      method: 'POST',
      headers: { 'content-type': clip.type || 'application/octet-stream', 'x-charla-device': deviceId() },
      body: clip,
      signal: ctl.signal,
    })
    if (!res.ok) throw new ApiError(res.status, `/api/stt ${res.status}`)
    const json = (await res.json()) as { text?: string }
    return json.text ?? ''
  } finally {
    clearTimeout(timer)
  }
}

/** The partner's line as a spoken clip. Nothing is kept on the server. */
export async function fetchSpeech(text: string, lang: Lang): Promise<Blob> {
  const ctl = new AbortController()
  const timer = setTimeout(() => ctl.abort(), TTS_TIMEOUT_MS)
  try {
    const res = await fetch(`${BASE}/api/tts`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text, lang, device: deviceId() }),
      signal: ctl.signal,
    })
    if (!res.ok) throw new ApiError(res.status, `/api/tts ${res.status}`)
    return await res.blob()
  } finally {
    clearTimeout(timer)
  }
}

export async function fetchReports(): Promise<Reports> {
  const res = await fetch(BASE + '/api/places')
  if (!res.ok) return {}
  return (await res.json()) as Reports
}
