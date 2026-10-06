import { sha256, today, yesterday, type Env } from './env'

// What keeps an abusive caller from spending the whole model budget.
//
// Two caps, because one is not enough: the per-device cap is the fair-use limit,
// but the device id is minted by the client (src/storage.ts) and a script can
// send a fresh one on every request, so it bounds nothing on its own. The
// per-IP cap is keyed on cf-connecting-ip, which the Cloudflare edge sets and
// the caller cannot forge.
//
// Both counters live in D1, not KV: KV is eventually consistent, so a burst of
// parallel requests would all read the same stale count and all pass, which is
// exactly the pattern a cap exists to stop. The D1 upsert is one atomic
// statement that returns the new value.
//
// No raw IP is ever written. The IP key is sha256(day + ':' + ip): one-way, and
// a different value every day, so the rows cannot be joined across days either.

/** Fails closed: a missing row (D1 hiccup) counts as over the cap. */
export async function bump(env: Env, key: string, cap: number): Promise<boolean> {
  const row = await env.DB.prepare(
    'INSERT INTO counters (k, day, n) VALUES (?1, ?2, 1) ON CONFLICT(k, day) DO UPDATE SET n = n + 1 RETURNING n',
  )
    .bind(key, today())
    .first<{ n: number }>()
  // The first hit on a key each day pays for the housekeeping: yesterday's
  // counters have done their job, and the table would otherwise grow forever.
  if (row?.n === 1) {
    await env.DB.prepare('DELETE FROM counters WHERE day < ?1').bind(yesterday()).run()
  }
  return (row?.n ?? cap + 1) <= cap
}

export function underCap(env: Env, deviceHash: string): Promise<boolean> {
  return bump(env, 'dev:' + deviceHash, Number(env.DAILY_TURN_CAP || '40'))
}

export function underIpCap(env: Env, ipHash: string): Promise<boolean> {
  return bump(env, 'ip:' + ipHash, Number(env.DAILY_IP_CAP || '400'))
}

// Speech has its own pair of counters, so a spoken turn costs one turn and one
// transcription rather than two turns, and a learner who speaks every line gets
// the same forty turns as one who types.
export function underSttCap(env: Env, deviceHash: string): Promise<boolean> {
  return bump(env, 'stt:' + deviceHash, Number(env.DAILY_STT_CAP || '60'))
}

export function underIpSttCap(env: Env, ipHash: string): Promise<boolean> {
  return bump(env, 'ipstt:' + ipHash, 600)
}

// The voice is the cheapest call of the three, and a learner may replay a line
// several times, so its allowance is wider than the turn cap.
export function underTtsCap(env: Env, deviceHash: string): Promise<boolean> {
  return bump(env, 'tts:' + deviceHash, Number(env.DAILY_TTS_CAP || '200'))
}

export function underIpTtsCap(env: Env, ipHash: string): Promise<boolean> {
  return bump(env, 'iptts:' + ipHash, 2000)
}

export function clientIp(req: Request): string {
  return req.headers.get('cf-connecting-ip') ?? 'unknown'
}

/** Day-scoped one-way key for the caller's IP. */
export function ipKey(req: Request): Promise<string> {
  return sha256(today() + ':' + clientIp(req))
}
