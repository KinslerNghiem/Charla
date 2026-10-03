// Everything a learner does lives on their device. There is no user table.
// Keys are prefixed so "Clear everything" can remove exactly ours and nothing else.

const PREFIX = 'charla.'

export function get<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(PREFIX + key)
    return raw === null ? fallback : (JSON.parse(raw) as T)
  } catch {
    return fallback
  }
}

export function set(key: string, value: unknown): void {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value))
  } catch {
    // Private mode or full storage: the app still works, it just forgets.
  }
}

export function remove(key: string): void {
  try {
    localStorage.removeItem(PREFIX + key)
  } catch {}
}

export function clearAll(): void {
  try {
    Object.keys(localStorage)
      .filter((k) => k.startsWith(PREFIX))
      .forEach((k) => localStorage.removeItem(k))
  } catch {}
}

// A random id minted on first launch. It goes with every request to the Worker
// (turns, help, reports, flags, speech) so the server can apply the daily caps;
// the Worker hashes it and never stores the raw value. It is linked to nothing
// and never shown.
export function deviceId(): string {
  let id = get<string>('device', '')
  if (!id) {
    id = crypto.randomUUID()
    set('device', id)
  }
  return id
}

export interface StreakEntry {
  ts: number
  place_id: string
  how: 'easy' | 'okay' | 'hard'
}

export function addStreak(entry: StreakEntry): StreakEntry[] {
  const list = get<StreakEntry[]>('streak', [])
  list.push(entry)
  set('streak', list)
  return list
}

export function streakThisWeek(now = Date.now()): number {
  const week = 7 * 86400000
  return get<StreakEntry[]>('streak', []).filter((e) => now - e.ts < week).length
}
