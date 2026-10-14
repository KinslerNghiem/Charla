import { get, remove, set } from '../storage'
import type { SkillId } from './skills'

// What the learner has done with each skill, on this device only, under the
// same charla. prefix as everything else, so "Clear everything" removes it.
// Three facts per skill: when it was last tried in the drill, whether they
// marked it to practice again, and the conversations it was used in. No
// points, no streaks, no comparison with anyone.

const KEY = 'skills'
/** Uses kept per skill; older ones fall off. Enough to show "used in a conversation" with where. */
const MAX_USES = 20

export interface SkillUse {
  scene_id: string
  ts: number
}

export interface SkillProgress {
  /** When the drill last recognized the skill. */
  tried?: number
  /** The learner wants to come back to this one. */
  again?: boolean
  used: SkillUse[]
}

export type SkillsStore = Partial<Record<SkillId, SkillProgress>>

export type SkillStatus = 'new' | 'tried' | 'used'

export function skillsStore(): SkillsStore {
  const raw = get<unknown>(KEY, {})
  return raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as SkillsStore) : {}
}

function entry(store: SkillsStore, id: SkillId): SkillProgress {
  const e = store[id]
  return e && Array.isArray(e.used) ? { ...e, used: [...e.used] } : { used: [] }
}

function save(store: SkillsStore): SkillsStore {
  set(KEY, store)
  return store
}

/** The drill recognized the skill, or the learner used one of the app's own lines for it (a chip). */
export function markTried(id: SkillId, now = Date.now()): SkillsStore {
  const store = skillsStore()
  store[id] = { ...entry(store, id), tried: now }
  return save(store)
}

export function setAgain(id: SkillId, on: boolean): SkillsStore {
  const store = skillsStore()
  store[id] = { ...entry(store, id), again: on }
  return save(store)
}

/** The learner used the skill in their own words during a conversation. */
export function recordUse(id: SkillId, scene_id: string, now = Date.now()): SkillsStore {
  const store = skillsStore()
  const e = entry(store, id)
  e.used = [...e.used, { scene_id, ts: now }].slice(-MAX_USES)
  store[id] = e
  return save(store)
}

export function statusOf(store: SkillsStore, id: SkillId): SkillStatus {
  const e = store[id]
  if (e && Array.isArray(e.used) && e.used.length > 0) return 'used'
  if (e && e.tried) return 'tried'
  return 'new'
}

/** Forget every skill's progress. The rest of the device's data is untouched. */
export function resetSkills(): void {
  remove(KEY)
}
