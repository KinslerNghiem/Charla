import { json, sha256, today, type Env } from './env'
import { clientIp, underCap, underIpCap } from './caps'
import { runHelp, runTurn, type TurnInput } from './tutor'
import { sceneById } from '../../src/content/scenes'

// One Worker, every secret, six routes. Nothing here stores who a learner is.

const YEAR = 365 * 86400000
const MONTH = 30 * 86400000
const FLAG_RETENTION = 60 * 86400000
const MAX_BODY = 32_000
// A push-to-talk clip: ten seconds of AAC or Opus is well under this.
const MAX_AUDIO = 1_500_000

// Free text from a report is limited to a short list of counter roles. The map
// is about places, so a role is a job, never a person.
const ROLES = ['cashier', 'pharmacist', 'clerk', 'server', 'librarian', 'nurse', 'front_desk', 'other']
const SHIFTS = ['morning', 'afternoon', 'evening', 'weekend']

// Workers AI's Whisper turbo takes base64 audio and a language hint. Typed
// loosely on purpose: the binding's generated model types change between
// workers-types releases, and this is the one call we make.
async function transcribe(ai: Ai, bytes: Uint8Array, lang: 'en' | 'es'): Promise<string | null> {
  let b64 = ''
  const CHUNK = 0x8000
  for (let i = 0; i < bytes.length; i += CHUNK) b64 += String.fromCharCode(...bytes.subarray(i, i + CHUNK))
  b64 = btoa(b64)
  try {
    const run = (ai as unknown as { run: (model: string, input: unknown) => Promise<{ text?: string }> }).run
    const res = await run.call(ai, '@cf/openai/whisper-large-v3-turbo', { audio: b64, language: lang })
    return typeof res?.text === 'string' ? res.text.trim().slice(0, 600) : ''
  } catch (err) {
    console.log(JSON.stringify({ route: 'stt', error: err instanceof Error ? err.name : 'error' }))
    return null
  }
}

function cors(res: Response, env: Env): Response {
  const h = new Headers(res.headers)
  h.set('access-control-allow-origin', env.ALLOWED_ORIGIN || 'null')
  h.set('access-control-allow-methods', 'GET, POST, OPTIONS')
  h.set('access-control-allow-headers', 'content-type, x-charla-device')
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
    const turn = await runTurn(env, { ...body, place_name })
    // 503, not a canned 200: the app shows the scripted scene and a retry button.
    return turn ? json(turn) : json({ error: 'model unavailable' }, 503)
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
    // The installed iOS app cannot use Safari's speech recognition, so it posts
    // a short clip here. The clip is transcribed by Workers AI and discarded:
    // nothing is written, and the transcript goes back only to the caller.
    if (!env.AI) return json({ error: 'speech not enabled' }, 503)
    const device = req.headers.get('x-charla-device') ?? ''
    if (!device) return json({ error: 'bad request' }, 400)
    if (Number(req.headers.get('content-length') ?? 0) > MAX_AUDIO) return json({ error: 'too long' }, 413)
    if (!(await underIpCap(env, clientIp(req)))) return json({ error: 'slow down' }, 429)
    if (!(await underCap(env, await sha256(device)))) return json({ error: 'daily cap reached' }, 429)
    const bytes = new Uint8Array(await req.arrayBuffer())
    if (bytes.byteLength === 0 || bytes.byteLength > MAX_AUDIO) return json({ error: 'too long' }, 413)
    const lang = new URL(req.url).searchParams.get('lang') === 'es' ? 'es' : 'en'
    const out = await transcribe(env.AI, bytes, lang)
    return out === null ? json({ error: 'speech unavailable' }, 503) : json({ text: out })
  }

  return json({ error: 'not found' }, 404)
}
