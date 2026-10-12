// The conversation bench: scripted learners, a real model, transcripts for a
// bilingual reader. Each conversation walks one scene at one level in one
// direction with the turns a real learner produces (a recastable mistake, a
// code-switched line, a stuck moment, the Simpler button) and records what
// the partner said, plus the deterministic flags the Worker itself can judge.
//
// Usage:
//   npm run worker:dev                       (in another terminal)
//   node scripts/convo-bench.mjs             (against http://localhost:8787)
//   BENCH_BASE=https://charla-api.<you>.workers.dev node scripts/convo-bench.mjs
//
// Each run costs model turns on the account's Workers AI allowance: about
// 25 turns plus any rewrites. Output: .bench/<stamp>.md, which is gitignored.
// Naturalness and correction quality are not judged here; the rubric is in
// docs/ai-quality-review.md.

import fs from 'node:fs'
import path from 'node:path'
import { randomUUID } from 'node:crypto'

const BASE = process.env.BENCH_BASE ?? 'http://localhost:8787'
const device = 'bench-' + randomUUID()
const SIMPLER = '__simpler__'

const CONVERSATIONS = [
  {
    name: 'Spanish speaker, English, A1, pharmacy',
    scene: 'pharmacy-refill',
    level: 'A1',
    learning: 'en',
    turns: [
      'Hello, I need pick up medicine for my mother.',
      'Her last name is Garcia. She born 3 May 1960.',
      SIMPLER,
      'She takes it with food?',
      'Thank you.',
    ],
  },
  {
    name: 'Spanish speaker, English, B1, clinic',
    scene: 'clinic-front-desk',
    level: 'B1',
    learning: 'en',
    turns: [
      'Hi, I have an appointment at 10:30. My last name is Delgado.',
      'Sorry, no entendí, could you repeat that more slowly?',
      'June 12th, 1988. Here is my insurance card, and nothing has changed.',
      'Do you have this form in Spanish?',
      "Thank you, I'll fill it out and bring it back.",
    ],
  },
  {
    name: 'English speaker, Spanish, A1, pharmacy',
    scene: 'pharmacy-refill',
    level: 'A1',
    learning: 'es',
    turns: [
      'Hola, yo necesito medicina para mi cabeza dolor.',
      'Es para mi mother, García. Nació el 3 de mayo de 1960.',
      SIMPLER,
      '¿Ella toma con comida?',
      'Gracias.',
    ],
  },
  {
    name: 'English speaker, Spanish, B1, school office',
    scene: 'school-office',
    level: 'B1',
    learning: 'es',
    turns: [
      'Buenos días, vengo a recoger mi hijo temprano, Mateo Delgado, de tercer grado.',
      'Tiene un appointment con el dentista a las dos.',
      "how do you say 'sign-out sheet'? I don't know the word.",
      'Sí, aquí está mi identificación. ¿Dónde firmo?',
      'Gracias por su ayuda. ¿Puedo pedir un intérprete para la reunión con la maestra?',
    ],
  },
]

// Light, local versions of the Worker's own checks, so a reader sees the flags next to the line.
const ES = new Set(['el', 'la', 'los', 'las', 'un', 'una', 'es', 'está', 'usted', 'su', 'qué', 'que', 'y', 'para', 'de', 'en', 'con', 'aquí', 'puede', 'tiene', 'sí', 'gracias', 'nombre', 'cómo', 'claro', 'por', 'favor', 'me', 'le', 'lo', 'al', 'del', 'hay', 'ya', 'muy', 'bien', 'más', 'algo'])
const EN = new Set(['the', 'a', 'an', 'is', 'are', 'you', 'your', 'i', 'we', 'it', 'what', 'and', 'or', 'to', 'for', 'of', 'in', 'on', 'with', 'here', 'please', 'can', 'do', 'have', 'that', 'this', 'okay', 'yes', 'thank', 'name', 'need', 'how', 'where', 'sure', 'let', 'me', 'my', 'she', 'he', 'they'])
const PRAISE = /\b(great|good|nice|excellent|perfect|wonderful)\s+(job|work|english|spanish)\b|\bwell done\b|\byour (english|spanish) is\b|buen trabajo|bien dicho|felicidades/i

function langOf(text) {
  const toks = text.toLowerCase().replace(/[^\p{L}' ]+/gu, ' ').split(/\s+/).filter(Boolean)
  let es = 0
  let en = 0
  for (const t of toks) {
    if (ES.has(t)) es++
    if (EN.has(t)) en++
  }
  return es === en ? '?' : es > en ? 'es' : 'en'
}
const words = (s) => s.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length
const sentences = (s) => s.split(/(?<=[.!?])\s+/).filter(Boolean)
const BAND = { A1: [2, 8], A2: [3, 12], B1: [4, 18] }

function flags(reply, level, learning, prev) {
  const out = []
  const [maxS, maxW] = BAND[level]
  const ss = sentences(reply)
  const allow = learning === 'es' && level !== 'B1' ? 2 : 0
  if (ss.length > maxS) out.push(`${ss.length} sentences > ${maxS}`)
  for (const s of ss) if (words(s) > maxW + allow) out.push(`"${s.slice(0, 30)}…" ${words(s)} words > ${maxW + allow}`)
  const l = langOf(reply)
  if (l !== '?' && l !== learning) out.push(`reads as ${l}, expected ${learning}`)
  if (PRAISE.test(reply)) out.push('praise')
  const first = (t) => t.trim().split(/\s+/)[0]?.replace(/[^\p{L}]/gu, '').toLowerCase()
  if (prev && first(prev) && first(prev) === first(reply)) out.push(`same opener as previous reply ("${first(reply)}")`)
  return out
}

async function turn(c, history, user, command) {
  const res = await fetch(BASE + '/api/turn', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ device, scene_id: c.scene, level: c.level, learning: c.learning, history, user, command }),
  })
  if (!res.ok) return { error: `${res.status} ${await res.text()}` }
  return res.json()
}

const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
const outDir = path.resolve('.bench')
fs.mkdirSync(outDir, { recursive: true })
const lines = [`# Conversation bench, ${stamp}`, '', `Against ${BASE}. Flags are the Worker's own deterministic checks, re-run here. Everything else needs a bilingual reader: see docs/ai-quality-review.md.`, '']
let totalFlags = 0
let kept = 0
let turns = 0

for (const c of CONVERSATIONS) {
  lines.push(`## ${c.name}`, '')
  const history = []
  let prev = null
  for (const u of c.turns) {
    const command = u === SIMPLER ? 'simpler' : undefined
    const level = command ? (c.level === 'B1' ? 'A2' : 'A1') : c.level
    const r = await turn({ ...c, level }, history, command ? '' : u, command)
    turns++
    lines.push(`**Learner:** ${command ? '_(Simpler)_' : u}`)
    if (r.error) {
      lines.push(`**Partner:** _error ${r.error}_`, '')
      console.log(`${c.name}: error ${r.error}`)
      continue
    }
    const f = flags(r.reply, level, c.learning, prev)
    totalFlags += f.length
    if (r.kept_at_level) kept++
    lines.push(`**Partner:** ${r.reply}${r.kept_at_level ? ' _(rewritten once by the Worker)_' : ''}`)
    if (r.tip) lines.push(`- tip: ${r.tip}`)
    if (r.alt?.length) lines.push(`- alt: ${r.alt.join(' | ')}`)
    if (!r.on_topic) lines.push('- off topic')
    if (r.goal_reached) lines.push('- goal reached')
    if (f.length) lines.push(`- FLAGS: ${f.join('; ')}`)
    lines.push('')
    if (!command) history.push({ role: 'user', content: u })
    history.push({ role: 'assistant', content: r.reply })
    prev = r.reply
    console.log(`${c.name} | ${command ? '(simpler)' : u.slice(0, 40)} -> ${r.reply.slice(0, 70)}${f.length ? '  FLAGS: ' + f.join('; ') : ''}`)
  }
}

lines.push('## Totals', '', `- turns: ${turns}`, `- rewritten by the Worker: ${kept}`, `- flags left after rewrite: ${totalFlags}`, '', '## Human review', '', 'Score each conversation on the rubric in docs/ai-quality-review.md (naturalness, role, recasting, no praise, code-switch handling, simpler, progression).', '')
const file = path.join(outDir, `${stamp}.md`)
fs.writeFileSync(file, lines.join('\n'), 'utf8')
console.log(`\nturns ${turns}, rewritten ${kept}, flags ${totalFlags}\nwrote ${path.relative(process.cwd(), file)}`)
