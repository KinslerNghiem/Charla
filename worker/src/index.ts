import { errName, json, log, runAi, sha256, today, type Env } from './env'
import { bump, ipKey, underCap, underIpCap, underIpSttCap, underIpTtsCap, underSttCap, underTtsCap } from './caps'
import { runHelp, runTurn, type TurnInput } from './tutor'
import { blocked, meta } from './safety'
import { DEFAULT_TTS_BUDGET_MODEL, DEFAULT_TTS_MODEL, isShippedLine, MAX_TTS_CHARS, synthesize, ttsModel } from './tts'
import { sceneById } from '../../src/content/scenes'
import venuesText from '../../public/venues.geojson'

// One Worker, every secret, eight routes. Nothing here stores who a learner is.

const YEAR = 365 * 86400000
const MONTH = 30 * 86400000
const FLAG_RETENTION = 60 * 86400000
const MAX_BODY = 32_000
// A push-to-talk clip is 20 s of 16 kHz 16-bit mono WAV (~640 KB); this leaves
// room for a longer or fatter encoding without accepting a whole song.
const MAX_AUDIO = 1_500_000
// One IP contributes at most this many reports per place per day.
const REPORTS_PER_PLACE = 2

// Free text from a report is limited to a short list of counter roles. The map
// is about places, so a role is a job, never a person.
const ROLES = ['cashier', 'pharmacist', 'clerk', 'server', 'librarian', 'nurse', 'front_desk', 'other']
const SHIFTS = ['morning', 'afternoon', 'evening', 'weekend']

// The shipped venue file is bundled in as text (see the [[rules]] block in
// wrangler.toml), so a report can only ever name a place the map shows.
// Parsed once per isolate, on the first report.
let venueIds: Set<string> | null = null
function knownPlace(id: string): boolean {
  if (!venueIds) {
    const fc = JSON.parse(venuesText) as { features?: { properties?: { id?: string } }[] }
    venueIds = new Set((fc.features ?? []).map((f) => f.properties?.id).filter((x): x is string => typeof x === 'string'))
  }
  return venueIds.has(id)
}

// Workers AI's Whisper turbo takes base64 audio and a language hint.
async function transcribe(ai: Ai, bytes: Uint8Array, lang: 'en' | 'es'): Promise<string | null> {
  let b64 = ''
  const CHUNK = 0x8000
  for (let i = 0; i < bytes.length; i += CHUNK) b64 += String.fromCharCode(...bytes.subarray(i, i + CHUNK))
  b64 = btoa(b64)
  try {
    const res = (await runAi(ai, '@cf/openai/whisper-large-v3-turbo', { audio: b64, language: lang })) as { text?: string } | null
    return typeof res?.text === 'string' ? res.text.trim().slice(0, 600) : ''
  } catch (err) {
    log({ route: 'stt', error: errName(err) })
    return null
  }
}

// With ALLOWED_ORIGIN unset there is no allow-origin header at all (never the
// string 'null', which some browsers honour for sandboxed pages).
function cors(res: Response, env: Env): Response {
  const h = new Headers(res.headers)
  if (env.ALLOWED_ORIGIN) h.set('access-control-allow-origin', env.ALLOWED_ORIGIN)
  h.set('access-control-allow-methods', 'GET, POST, OPTIONS')
  h.set('access-control-allow-headers', 'content-type, x-charla-device')
  h.set('access-control-max-age', '86400')
  h.set('vary', 'origin')
  return new Response(res.body, { status: res.status, headers: h })
}

// Bodies are read against a byte budget, not a content-length header, which a
// caller sets to whatever it likes. Over budget, the read stops where it is and
// the route answers 413.
const TOO_LARGE: unique symbol = Symbol('too large')

async function readBytes(req: Request, max: number): Promise<Uint8Array | typeof TOO_LARGE> {
  if (Number(req.headers.get('content-length') ?? 0) > max) return TOO_LARGE
  const reader = req.body?.getReader()
  if (!reader) return new Uint8Array(0)
  const chunks: Uint8Array[] = []
  let total = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    total += value.byteLength
    if (total > max) {
      await reader.cancel()
      return TOO_LARGE
    }
    chunks.push(value)
  }
  const out = new Uint8Array(total)
  let off = 0
  for (const c of chunks) {
    out.set(c, off)
    off += c.byteLength
  }
  return out
}

async function readBody<T>(req: Request): Promise<T | null | typeof TOO_LARGE> {
  const bytes = await readBytes(req, MAX_BODY)
  if (bytes === TOO_LARGE) return TOO_LARGE
  try {
    return JSON.parse(new TextDecoder().decode(bytes)) as T
  } catch {
    return null
  }
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    if (req.method === 'OPTIONS') return cors(new Response(null, { status: 204 }), env)
    // A browser always sends Origin on a POST. One that is not the app is
    // refused outright rather than answered and then hidden by CORS, which
    // would still have spent a model call. Requests with no Origin (curl, the
    // tests, server-to-server) are not browsers and pass.
    const origin = req.headers.get('origin')
    if (req.method === 'POST' && origin !== null && origin !== env.ALLOWED_ORIGIN) {
      return cors(json({ error: 'forbidden' }, 403), env)
    }
    const url = new URL(req.url)
    try {
      const res = await route(req, env, url)
      return cors(res, env)
    } catch (err) {
      // A shape, never a message: an SDK error's message can carry the upstream
      // response body, and a JSON parse error can carry a fragment of the input.
      console.error(
        JSON.stringify({
          route: url.pathname,
          error: errName(err),
          status: (err as { status?: number })?.status ?? null,
        }),
      )
      return cors(json({ error: 'server' }, 500), env)
    }
  },
}

async function route(req: Request, env: Env, url: URL): Promise<Response> {
  const path = url.pathname
  if (path === '/api/health') return json({ ok: true })

  // Every route that can reach the model or write a row is bounded twice: by the
  // caller's device id (fair use) and by their IP (which the edge sets, so a
  // script cannot mint its way around it). Validation comes first, so a
  // malformed request never spends a counter.
  if (path === '/api/turn' && req.method === 'POST') {
    const body = await readBody<TurnInput & { device?: string }>(req)
    if (body === TOO_LARGE) return json({ error: 'too large' }, 413)
    if (!body?.device) return json({ error: 'bad request' }, 400)
    if (!sceneById(body.scene_id)) return json({ error: 'unknown scene' }, 400)
    const command = body.command === 'simpler' || body.command === 'another_way' ? body.command : undefined
    if (!command && !String(body.user ?? '').trim()) return json({ error: 'bad request' }, 400)
    if (!(await underIpCap(env, await ipKey(req)))) return json({ error: 'slow down' }, 429)
    if (!(await underCap(env, await sha256(body.device)))) return json({ error: 'daily cap reached' }, 429)
    // The place name comes from a URL parameter. It is clamped to a name's
    // characters, and one that reads as an instruction is dropped, not sent.
    let place_name = typeof body.place_name === 'string' ? body.place_name.replace(/[^\p{L}\p{N} '&.,()-]/gu, '').slice(0, 60) : undefined
    if (place_name && meta(place_name)) place_name = undefined
    const turn = await runTurn(env, { ...body, command, place_name })
    // 503, not a canned 200: the app shows the scripted scene and a retry button.
    return turn ? json(turn) : json({ error: 'model unavailable' }, 503)
  }

  if (path === '/api/help' && req.method === 'POST') {
    const body = await readBody<{ text: string; from: 'en' | 'es'; to: 'en' | 'es'; device?: string }>(req)
    if (body === TOO_LARGE) return json({ error: 'too large' }, 413)
    if (!body?.device || !body.text) return json({ error: 'bad request' }, 400)
    if (!(await underIpCap(env, await ipKey(req)))) return json({ error: 'slow down' }, 429)
    if (!(await underCap(env, await sha256(body.device)))) return json({ error: 'daily cap reached' }, 429)
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
    if (body === TOO_LARGE) return json({ error: 'too large' }, 413)
    if (!body?.device || typeof body.place_id !== 'string') return json({ error: 'bad request' }, 400)
    if (!knownPlace(body.place_id)) return json({ error: 'unknown place' }, 400)
    const ip = await ipKey(req)
    if (!(await underIpCap(env, ip))) return json({ error: 'slow down' }, 429)
    // A fresh device id per request would otherwise let one script fill a
    // place's count; an IP gets a couple of reports per place per day.
    if (!(await bump(env, `rep:${ip}:${body.place_id}`, REPORTS_PER_PLACE))) return json({ error: 'slow down' }, 429)
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
      .bind(body.place_id, body.lang === 'en' ? 'en' : 'es', body.positive === false ? 0 : 1, role, shift, hash, today(), Date.now())
      .run()
    return json({ ok: true, duplicate: (res.meta?.changes ?? 0) === 0 })
  }

  if (path === '/api/places' && req.method === 'GET') {
    // Served from the edge cache for the max-age below, so a classroom opening
    // the map together costs one aggregate, not thirty. The cached response is
    // the bare JSON; cors() is applied to it on the way out like any other.
    const cache = (globalThis as { caches?: { default?: Cache } }).caches?.default
    const key = new Request(url.origin + url.pathname)
    if (cache) {
      const hit = await cache.match(key)
      if (hit) return hit
    }
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
    const res = json(out, 200, { 'cache-control': 'public, max-age=300' })
    if (cache) await cache.put(key, res.clone())
    return res
  }

  if (path === '/api/flag' && req.method === 'POST') {
    const body = await readBody<{ scene_id?: string; reply?: string; reason?: string; device?: string }>(req)
    if (body === TOO_LARGE) return json({ error: 'too large' }, 413)
    if (!body?.device) return json({ error: 'bad request' }, 400)
    if (!(await underIpCap(env, await ipKey(req)))) return json({ error: 'slow down' }, 429)
    if (!(await underCap(env, await sha256(body.device)))) return json({ error: 'daily cap reached' }, 429)
    await env.DB.prepare('INSERT INTO flags (scene_id, reply, reason, created_at) VALUES (?, ?, ?, ?)')
      .bind(sceneById(body.scene_id)?.id ?? null, String(body.reply ?? '').slice(0, 2000), String(body.reason ?? '').slice(0, 200), Date.now())
      .run()
    await env.DB.prepare('DELETE FROM flags WHERE created_at < ?').bind(Date.now() - FLAG_RETENTION).run()
    return json({ ok: true })
  }

  if (path === '/api/stt' && req.method === 'POST') {
    // The recorder tier is the default on every browser: the app posts a short
    // clip here. The clip is transcribed by Workers AI and discarded: nothing
    // is written, and the transcript goes back only to the caller. Speech has
    // its own caps, so a spoken turn does not cost two of the day's turns.
    if (!env.AI) return json({ error: 'speech not enabled' }, 503)
    const device = req.headers.get('x-charla-device') ?? ''
    if (!device) return json({ error: 'bad request' }, 400)
    if (Number(req.headers.get('content-length') ?? 0) > MAX_AUDIO) return json({ error: 'too long' }, 413)
    if (!(await underIpSttCap(env, await ipKey(req)))) return json({ error: 'slow down' }, 429)
    if (!(await underSttCap(env, await sha256(device)))) return json({ error: 'daily cap reached' }, 429)
    const bytes = await readBytes(req, MAX_AUDIO)
    if (bytes === TOO_LARGE || bytes.byteLength === 0) return json({ error: 'too long' }, 413)
    const lang = url.searchParams.get('lang') === 'es' ? 'es' : 'en'
    const out = await transcribe(env.AI, bytes, lang)
    return out === null ? json({ error: 'speech unavailable' }, 503) : json({ text: out })
  }

  if (path === '/api/tts' && req.method === 'POST') {
    // The partner's line in, a spoken clip out. See tts.ts for the model and
    // for why only lines that ship with the app are ever cached.
    if (!env.AI) return json({ error: 'voice not enabled' }, 503)
    const body = await readBody<{ text?: string; lang?: string; device?: string }>(req)
    if (body === TOO_LARGE) return json({ error: 'too large' }, 413)
    if (!body?.device || typeof body.text !== 'string') return json({ error: 'bad request' }, 400)
    const text = body.text.replace(/\s+/g, ' ').trim().slice(0, MAX_TTS_CHARS)
    if (!text || blocked(text)) return json({ error: 'bad request' }, 400)
    const lang = body.lang === 'es' ? 'es' : 'en'

    const edge = typeof caches !== 'undefined' ? (caches as unknown as { default?: Cache }).default : undefined
    const fixed = isShippedLine(text)
    const key = fixed && edge ? new Request(`${url.origin}/__tts/${await sha256(lang + '|' + text)}`) : null
    if (key && edge) {
      const hit = await edge.match(key)
      if (hit) return hit
    }

    if (!(await underIpTtsCap(env, await ipKey(req)))) return json({ error: 'slow down' }, 429)
    if (!(await underTtsCap(env, await sha256(body.device)))) return json({ error: 'daily cap reached' }, 429)
    // The natural voice while the day's allowance lasts, the cheap one after,
    // and the cheap one also when the natural one fails.
    const premium = ttsModel(env.TTS_MODEL, DEFAULT_TTS_MODEL, lang)
    const budget = ttsModel(env.TTS_BUDGET_MODEL, DEFAULT_TTS_BUDGET_MODEL, lang)
    const speaker = lang === 'es' ? env.TTS_SPEAKER_ES : env.TTS_SPEAKER_EN
    let model = premium
    let speech = (await bump(env, 'ttsall', Number(env.DAILY_TTS_PREMIUM || '40'))) ? await synthesize(env.AI, premium, text, lang, speaker) : null
    if (!speech && budget !== premium) {
      model = budget
      speech = await synthesize(env.AI, budget, text, lang)
    }
    log({ route: 'tts', model, chars: text.length, bytes: speech?.bytes.byteLength ?? 0, fixed })
    if (!speech) return json({ error: 'voice unavailable' }, 503)
    const res = new Response(speech.bytes, {
      headers: { 'content-type': speech.type, 'cache-control': fixed ? 'public, max-age=2592000' : 'no-store' },
    })
    if (key && edge) await edge.put(key, res.clone())
    return res
  }

  return json({ error: 'not found' }, 404)
}
