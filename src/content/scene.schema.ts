// A scene is authored once, in both languages, and rendered three ways:
//   1. the adult/teen AI role-play (the card feeds the system prompt),
//   2. the scripted no-network fallback (offline_script),
//   3. Charlita, the kid mode (scenes marked kid: true, same offline_script).
// This file is shared by the app and the Worker; keep it free of DOM code.
//
// Who reads which side:
//   - Learner lines (choice text, must_use) are shown in the language being
//     learned, with the other side as a subtitle. Tips are read in the
//     learner's own language, so a tip explains the English mistake in both
//     languages.
//   - show_staff_line[L] is written for a reader who speaks L: the learner
//     shows (or the app reads aloud) the TARGET-language side to the staff, so
//     the es side is what an English speaker learning Spanish shows a
//     Spanish-speaking clerk ("Estoy practicando mi español…"), and the en
//     side is what a Spanish speaker shows an English-speaking clerk.
//   - Register in Spanish: kid scenes' partner speaks tú to the child; adult
//     scenes' partner (staff talking to a customer, patient or parent) speaks
//     usted, and the adult learner addresses staff as usted. A first-name
//     coworker such as a shift supervisor may use tú.

export interface Bi {
  en: string
  es: string
}

export type Level = 'A1' | 'A2' | 'B1'

export type Lang = 'en' | 'es'

/**
 * Every place a scene can be tied to. Each one needs a `type_<name>` label in
 * src/i18n/strings.ts and (for kid scenes) an icon in the Niños street.
 * scripts/check_scenes.py parses this list out of this file, so keep it as a
 * single array literal of quoted strings.
 */
export const PLACE_TYPES = [
  'pharmacy',
  'restaurant',
  'clinic',
  'driver_services',
  'school',
  'grocery',
  'library',
  'ice_cream',
  'home',
  'work',
  'college',
  'bank',
  'post_office',
  'transit',
  'park',
] as const

export type PlaceType = (typeof PLACE_TYPES)[number]

/** Where the conversation happens: face to face at a counter, or on the phone. */
export type Channel = 'counter' | 'phone'

export interface ScriptChoice {
  text: Bi
  /** Emoji used as the "picture" of this choice. Required on every choice; kid mode shows it. */
  picture?: string
  /**
   * Which direction a wrong answer is written for: 'en' when its mistake is
   * an English one (a Spanish speaker practicing English sees it), 'es' when
   * the mistake is a Spanish one. Absent means both, which is what the best
   * choices are: right in either language. choicesFor() applies this.
   */
  for?: Lang
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

/** The choices a learner practicing `learning` is shown: the best ones, plus the wrong answers written for that direction. */
export function choicesFor(node: ScriptNode, learning: Lang): ScriptChoice[] {
  return node.choices.filter((c) => !c.for || c.for === learning)
}

export interface Scene {
  id: string
  place_type: PlaceType
  kid?: boolean
  /** 'phone' for calls (landlord, calling in sick, the electric company); 'counter' for everything else. */
  channel?: Channel
  /**
   * True when the must-use lines carry an invented name, date or place
   * ("Her last name is Garcia…", "…to Mexico"). The Go Card then says so, so
   * nobody reads the example out loud at a real counter.
   */
  example_details?: boolean
  title: Bi
  roles: { partner: Bi; learner: Bi }
  goal: Bi
  /**
   * Two or three lines the learner can actually say, in sentence or question
   * form. They feed the Go Card, the chips, the Table prompts and the AI
   * prompt, so a bare noun ("prescription") does not belong here.
   */
  must_use: Bi[]
  /** The staff's first real question, e.g. "Last name and date of birth?" Shown on the card as what to expect. */
  expect?: Bi
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

const SENTENCE_END = /[.?!…]["”]?$/

/**
 * A must_use entry has to be a line the learner can say out loud: at least
 * three English words and sentence punctuation on both sides. "half a pound"
 * or "prescription" fail; "Half a pound of ham, please." passes.
 */
export function isLearnerLine(p: Bi): boolean {
  const words = p.en.trim().split(/\s+/).filter(Boolean)
  return words.length >= 3 && SENTENCE_END.test(p.en.trim()) && SENTENCE_END.test(p.es.trim())
}

/** Returns a list of problems; an empty list means the scene is valid. */
export function validateScene(s: unknown): string[] {
  const errs: string[] = []
  const x = s as Partial<Scene>
  if (!x || typeof x !== 'object') return ['not an object']
  if (typeof x.id !== 'string' || !/^[a-z0-9-]+$/.test(x.id)) errs.push('id must be kebab-case')
  if (typeof x.place_type !== 'string') errs.push('place_type missing')
  else if (!(PLACE_TYPES as readonly string[]).includes(x.place_type)) {
    errs.push(`place_type "${x.place_type}" is not one of ${PLACE_TYPES.join(', ')}`)
  }
  if (x.channel !== 'counter' && x.channel !== 'phone') errs.push('channel must be "counter" or "phone"')
  for (const k of ['title', 'goal', 'success', 'show_staff_line', 'expect'] as const) {
    if (!isBi(x[k])) errs.push(`${k} needs en and es`)
  }
  if (isBi(x.show_staff_line)) {
    if (!/english/i.test(x.show_staff_line.en)) errs.push('show_staff_line.en must say the learner is practicing English')
    if (!/español/i.test(x.show_staff_line.es)) errs.push('show_staff_line.es must say the learner is practicing español')
  }
  if (!x.roles || !isBi(x.roles.partner) || !isBi(x.roles.learner)) errs.push('roles need en and es')
  if (!Array.isArray(x.must_use) || x.must_use.length < 2 || x.must_use.length > 3 || !x.must_use.every(isBi)) {
    errs.push('must_use needs 2 or 3 bilingual phrases')
  } else {
    for (const p of x.must_use) {
      if (!isLearnerLine(p)) errs.push(`must_use "${p.en}" must be a line the learner can say (3+ words, ends with . ? or !)`)
    }
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
      if (c.for !== undefined && c.for !== 'en' && c.for !== 'es') errs.push(`node ${id}: "for" must be "en" or "es"`)
      if (typeof c.picture !== 'string' || c.picture.trim() === '') errs.push(`node ${id}: every choice needs a picture`)
      if (c.best) {
        best++
        if (c.next !== null && !script.nodes[c.next]) errs.push(`node ${id}: next "${c.next}" does not exist`)
      } else if (!isBi(c.tip)) {
        errs.push(`node ${id}: non-best choice needs a bilingual tip`)
      }
    }
    if (best === 0) errs.push(`node ${id}: needs at least one best choice`)
    // Both directions play this script: each must see a real choice to make.
    for (const dir of ['en', 'es'] as const) {
      const shown = Array.isArray(node.choices) ? choicesFor(node, dir) : []
      if (shown.length < 2) errs.push(`node ${id}: a learner practicing ${dir} sees fewer than 2 choices`)
      if (!shown.some((c) => c.best)) errs.push(`node ${id}: a learner practicing ${dir} sees no best choice`)
    }
  }
  return errs
}
