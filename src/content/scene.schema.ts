// A scene is authored once, in both languages, and rendered three ways:
//   1. the adult/teen AI role-play (the card feeds the system prompt),
//   2. the scripted no-network fallback (offline_script),
//   3. Charlita, the kid mode (scenes marked kid: true, same offline_script).
// This file is shared by the app and the Worker; keep it free of DOM code.

export interface Bi {
  en: string
  es: string
}

export type Level = 'A1' | 'A2' | 'B1'

export interface ScriptChoice {
  text: Bi
  /** Emoji used as the "picture" of this choice in kid mode. */
  picture?: string
  /** A best choice moves the script forward; any other choice shows its tip and stays. */
  best?: boolean
  tip?: Bi
  /** Node id to go to after a best choice; null ends the scene. */
  next: string | null
}

export interface ScriptNode {
  partner: Bi
  choices: ScriptChoice[]
}

export interface Scene {
  id: string
  place_type: string
  kid?: boolean
  title: Bi
  roles: { partner: Bi; learner: Bi }
  goal: Bi
  must_use: Bi[]
  success: Bi
  show_staff_line: Bi
  offline_script: { start: string; nodes: Record<string, ScriptNode> }
}

function isBi(v: unknown): v is Bi {
  return (
    !!v &&
    typeof v === 'object' &&
    typeof (v as Bi).en === 'string' &&
    (v as Bi).en.trim() !== '' &&
    typeof (v as Bi).es === 'string' &&
    (v as Bi).es.trim() !== ''
  )
}

/** Returns a list of problems; an empty list means the scene is valid. */
export function validateScene(s: unknown): string[] {
  const errs: string[] = []
  const x = s as Partial<Scene>
  if (!x || typeof x !== 'object') return ['not an object']
  if (typeof x.id !== 'string' || !/^[a-z0-9-]+$/.test(x.id)) errs.push('id must be kebab-case')
  if (typeof x.place_type !== 'string') errs.push('place_type missing')
  for (const k of ['title', 'goal', 'success', 'show_staff_line'] as const) {
    if (!isBi(x[k])) errs.push(`${k} needs en and es`)
  }
  if (!x.roles || !isBi(x.roles.partner) || !isBi(x.roles.learner)) errs.push('roles need en and es')
  if (!Array.isArray(x.must_use) || x.must_use.length < 2 || !x.must_use.every(isBi)) {
    errs.push('must_use needs at least 2 bilingual phrases')
  }
  const script = x.offline_script
  if (!script || typeof script.start !== 'string' || !script.nodes || typeof script.nodes !== 'object') {
    errs.push('offline_script needs start and nodes')
    return errs
  }
  if (!script.nodes[script.start]) errs.push(`start node "${script.start}" does not exist`)
  for (const [id, node] of Object.entries(script.nodes)) {
    if (!isBi(node.partner)) errs.push(`node ${id}: partner needs en and es`)
    if (!Array.isArray(node.choices) || node.choices.length < 2) errs.push(`node ${id}: needs at least 2 choices`)
    let best = 0
    for (const c of node.choices ?? []) {
      if (!isBi(c.text)) errs.push(`node ${id}: choice text needs en and es`)
      if (c.best) {
        best++
        if (c.next !== null && !script.nodes[c.next]) errs.push(`node ${id}: next "${c.next}" does not exist`)
      } else if (!isBi(c.tip)) {
        errs.push(`node ${id}: non-best choice needs a bilingual tip`)
      }
    }
    if (best === 0) errs.push(`node ${id}: needs at least one best choice`)
  }
  return errs
}
