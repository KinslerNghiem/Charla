// The neutral birth screen sets one of three modes. The three modes differ in
// capability, not just content: kid mode has no network, no mic, no map, no chat.
// The birth date itself is never stored; only the resulting mode flag is.

export type Mode = 'kid' | 'teen' | 'adult'

const RANK: Record<Mode, number> = { kid: 0, teen: 1, adult: 2 }

// Day of birth is unknown, so we assume the last day of the month. That can only
// understate age, never overstate it, which is the safe direction for a gate.
export function ageOn(birthMonth: number, birthYear: number, now: Date): number {
  let age = now.getFullYear() - birthYear
  if (now.getMonth() + 1 <= birthMonth) age -= 1
  return age
}

export function modeFor(birthMonth: number, birthYear: number, now = new Date()): Mode {
  const age = ageOn(birthMonth, birthYear, now)
  if (age < 13) return 'kid'
  if (age < 18) return 'teen'
  return 'adult'
}

// A mode can be lowered (a parent handing the phone to a child) but never raised
// without clearing site data and answering the gate again.
export function lowerOnly(current: Mode | null, next: Mode): Mode {
  if (!current) return next
  return RANK[next] < RANK[current] ? next : current
}

export function validBirth(month: number, year: number, now = new Date()): boolean {
  if (!Number.isInteger(month) || month < 1 || month > 12) return false
  if (!Number.isInteger(year) || year < now.getFullYear() - 120 || year > now.getFullYear()) return false
  return true
}
