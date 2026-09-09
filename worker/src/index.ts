import { json, sha256, today, type Env } from './env'
import { clientIp, underCap, underIpCap } from './caps'
import { runHelp, runTurn, type TurnInput } from './tutor'
import { sceneById } from '../../src/content/scenes'

// One Worker, every secret, six routes. Nothing here stores who a learner is.

const YEAR = 365 * 86400000
const MONTH = 30 * 86400000
const FLAG_RETENTION = 60 * 86400000
const MAX_BODY = 32_000

// Free text from a report is limited to a short list of counter roles. The map
// is about places, so a role is a job, never a person.
const ROLES = ['cashier', 'pharmacist', 'clerk', 'server', 'librarian', 'nurse', 'front_desk', 'other']
const SHIFTS = ['morning', 'afternoon', 'evening', 'weekend']

function cors(res: Response, env: Env): Response {
  const h = new Headers(res.headers)
  h.set('access-control-allow-origin', env.ALLOWED_ORIGIN || 'null')
  h.set('access-control-allow-methods', 'GET, POST, OPTIONS')
  h.set('access-control-allow-headers', 'content-type')
  h.set('access-control-max-age', '86400')
  h.set('vary', 'origin')
  return new Response(res.body, { status: res.status, headers: h })
}

async function readBody<T>(req: Request): Promise<T | null> {
  if (Number(req.headers.get('content-length') ?? 0) > MAX_BODY) return null
  try {
    return (await req.json()) as T
  } catch {
    return null
  }
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    if (req.method === 'OPTIONS') return cors(new Response(null, { status: 204 }), env)
    const url = new URL(req.url)
    try {
      const res = await route(req, env, url.pathname)
      return cors(res, env)
    } catch (err) {
      // A shape, never a message: an SDK error's message can carry the upstream
      // response body, and a JSON parse error can carry a fragment of the input.
      console.error(
        JSON.stringify({
          route: url.pathname,
          error: err instanceof Error ? err.name : 'error',
          status: (err as { status?: number })?.status ?? null,
        }),
      )
      return cors(json({ error: 'server' }, 500), env)
    }
  },
}

async function route(req: Request, env: Env, path: string): Promise<Response> {
  if (path === '/api/health') return json({ ok: true })

  // Every route that can reach the model or write a row is bounded twice: by the
  // caller's device id (fair use) and by their IP (which the edge sets, so a
  // script cannot mint its way around it).
  if (path === '/api/turn' && req.method === 'POST') {
    const body = await readBody<TurnInput & { device?: string }>(req)
    if (!body?.device || !body.scene_id) return json({ error: 'bad request' }, 400)
    if (!(await underIpCap(env, clientIp(req)))) return json({ error: 'slow down' }, 429)
    const hash = await sha256(body.device)
    if (!(await underCap(env, hash))) return json({ error: 'daily cap reached' }, 429)
    const place_name =
      typeof body.place_name === 'string' ? body.place_name.replace(/[^\p{L}\p{N} '&.,()-]/gu, '').slice(0, 60) : undefined
    return json(await runTurn(env, { ...body, place_name }))
  }

  if (path === '/api/help' && req.method === 'POST') {
    const body = await readBody<{ text: string; from: 'en' | 'es'; to: 'en' | 'es'; device?: string }>(req)
    if (!body?.device || !body.text) return json({ error: 'bad request' }, 400)
    if (!(await underIpCap(env, clientIp(req)))) return json({ error: 'slow down' }, 429)
    const hash = await sha256(body.device)
    if (!(await underCap(env, hash))) return json({ error: 'daily cap reached' }, 429)
    return json(await runHelp(env, body.text, body.from === 'es' ? 'es' : 'en', body.to === 'es' ? 'es' : 'en'))
  }

  if (path === '/api/report' && req.method === 'POST') {
    const body = await readBody<{
      place_id: string
      lang: string
      positive: boolean
      role?: string
      shift?: string
      device?: string
    }>(req)
    if (!body?.device || !body.place_id) return json({ error: 'bad request' }, 400)
    if (!(await underIpCap(env, clientIp(req)))) return json({ error: 'slow down' }, 429)
    // Salted with the place id: one visitor gets a different hash at every
    // place, so a place can still count distinct devices but the rows cannot be
    // joined into one person's trail.
    const hash = await sha256(body.device + ':' + body.place_id)
    const role = ROLES.includes(body.role ?? '') ? body.role! : null
    const shift = SHIFTS.includes(body.shift ?? '') ? body.shift! : null
    // The unique index on (device_hash, place_id, day) is the duplicate check.
    const res = await env.DB.prepare(
      'INSERT OR IGNORE INTO reports (place_id, lang, positive, role, shift, device_hash, day, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    )
      .bind(
        String(body.place_id).slice(0, 64),
        body.lang === 'en' ? 'en' : 'es',
        body.positive === false ? 0 : 1,
        role,
        shift,
        hash,
        today(),
        Date.now(),
      )
      .run()
    return json({ ok: true, duplicate: (res.meta?.changes ?? 0) === 0 })
  }

  if (path === '/api/places' && req.method === 'GET') {
    // Aggregated in SQL, in 30-day buckets, so the response stays a fixed size
    // however many reports exist, and no per-device identifier ever leaves here.
    const since = Date.now() - YEAR
    const buckets = await env.DB.prepare(
      `SELECT place_id, lang, positive, CAST((?1 - created_at) / ?2 AS INTEGER) AS bucket, COUNT(*) AS n
         FROM reports WHERE created_at > ?3
        GROUP BY place_id, lang, positive, bucket`,
    )
      .bind(Date.now(), MONTH, since)
      .all<{ place_id: string; lang: string; positive: number; bucket: number; n: number }>()
    const devices = await env.DB.prepare(
      `SELECT place_id, lang, COUNT(DISTINCT device_hash) AS devices
         FROM reports WHERE positive = 1 AND created_at > ?1
        GROUP BY place_id, lang`,
    )
      .bind(since)
      .all<{ place_id: string; lang: string; devices: number }>()

    type Agg = { devices: number; buckets: { b: number; positive: boolean; n: number }[] }
    const out: Record<string, Record<string, Agg>> = {}
    const slot = (place: string, lang: string): Agg => {
      const byLang = (out[place] ??= {})
      return (byLang[lang] ??= { devices: 0, buckets: [] })
    }
    for (const r of buckets.results ?? []) {
      slot(r.place_id, r.lang).buckets.push({ b: r.bucket, positive: r.positive === 1, n: r.n })
    }
    for (const r of devices.results ?? []) {
      slot(r.place_id, r.lang).devices = r.devices
    }
    return json(out, 200, { 'cache-control': 'public, max-age=300' })
  }

  if (path === '/api/flag' && req.method === 'POST') {
    const body = await readBody<{ scene_id?: string; reply?: string; reason?: string; device?: string }>(req)
    if (!body?.device) return json({ error: 'bad request' }, 400)
    if (!(await underIpCap(env, clientIp(req)))) return json({ error: 'slow down' }, 429)
    const hash = await sha256(body.device)
    if (!(await underCap(env, hash))) return json({ error: 'daily cap reached' }, 429)
    await env.DB.prepare('INSERT INTO flags (scene_id, reply, reason, created_at) VALUES (?, ?, ?, ?)')
      .bind(sceneById(body.scene_id)?.id ?? null, (body.reply ?? '').slice(0, 2000), (body.reason ?? '').slice(0, 200), Date.now())
      .run()
    await env.DB.prepare('DELETE FROM flags WHERE created_at < ?').bind(Date.now() - FLAG_RETENTION).run()
    return json({ ok: true })
  }

  if (path === '/api/stt' && req.method === 'POST') {
    // Should-have: forward the audio clip to a transcription API and discard it.
    // Until then the app shows "type instead" on installed iOS.
    return json({ error: 'not implemented yet' }, 501)
  }

  return json({ error: 'not found' }, 404)
}
