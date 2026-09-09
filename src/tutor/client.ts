import type { Level } from './levels'
import type { Turn, Help } from './turn'
import type { Lang } from '../i18n/strings'
import type { Reports } from '../places/badges'
import { deviceId } from '../storage'

// In production the Worker can live on another origin; set VITE_API_BASE.
// In dev, vite proxies /api to wrangler on 8787 and this stays empty.
const BASE = (import.meta.env.VITE_API_BASE as string | undefined) ?? ''

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

export function askTutor(req: TurnRequest): Promise<Turn> {
  return post<Turn>('/api/turn', req)
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

export async function fetchReports(): Promise<Reports> {
  const res = await fetch(BASE + '/api/places')
  if (!res.ok) return {}
  return (await res.json()) as Reports
}
