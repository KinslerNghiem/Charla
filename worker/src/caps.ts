import { today, type Env } from './env'

// What keeps an abusive caller from spending the whole Anthropic budget.
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

async function bump(env: Env, key: string, cap: number): Promise<boolean> {
  const row = await env.DB.prepare(
    'INSERT INTO counters (k, day, n) VALUES (?1, ?2, 1) ON CONFLICT(k, day) DO UPDATE SET n = n + 1 RETURNING n',
  )
    .bind(key, today())
    .first<{ n: number }>()
  return (row?.n ?? cap + 1) <= cap
}

export function underCap(env: Env, deviceHash: string): Promise<boolean> {
  return bump(env, 'dev:' + deviceHash, Number(env.DAILY_TURN_CAP || '40'))
}

export function underIpCap(env: Env, ip: string): Promise<boolean> {
  return bump(env, 'ip:' + ip, Number(env.DAILY_IP_CAP || '400'))
}

export function clientIp(req: Request): string {
  return req.headers.get('cf-connecting-ip') ?? 'unknown'
}
