import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { STRINGS } from '../src/i18n/strings'

// Kid mode collects nothing. That is a legal position (the FTC's COPPA guidance
// says data that stays on the device and is never transmitted is not
// "collected") and it only holds if the code stays that way. This test walks
// every module the kid route can reach and fails on anything that could touch
// the network or a sensor.
//
// It starts from src/app.tsx, not from Ninos.tsx: what matters is what a child's
// browser actually loads. app.tsx imports Ninos statically and everything
// networked through a dynamic import(), which this walker deliberately does not
// follow, so that separation is what is being asserted.

const ROOT = fileURLToPath(new URL('../src', import.meta.url))
const ENTRY = join(ROOT, 'app.tsx')

const FORBIDDEN: [RegExp, string][] = [
  [/\bfetch\s*\(/, 'network request'],
  [/\/api\b/, 'Worker route'],
  [/XMLHttpRequest/, 'network request'],
  [/WebSocket/, 'network connection'],
  [/navigator\.sendBeacon/, 'network request'],
  [/maplibre/, 'map tiles'],
  [/geolocation/, 'location'],
  [/mediaDevices/, 'microphone'],
  [/SpeechRecognition/, 'microphone'],
  [/MediaRecorder/, 'microphone'],
]

// Only these may be imported from node_modules on the kid path.
const ALLOWED_PACKAGES = ['preact', 'preact/hooks', 'preact/jsx-runtime']

const STATIC_IMPORT = /(?:^|[\s;])(?:import|export)\s+(?:[^'"()]*?\sfrom\s+)?['"]([^'"]+)['"]/g
const DYNAMIC_IMPORT = /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g

function resolveImport(fromFile: string, spec: string): string | null {
  const base = join(fromFile, '..', spec)
  for (const cand of [base, base + '.ts', base + '.tsx', base + '.js', base + '.jsx', join(base, 'index.ts'), join(base, 'index.tsx')]) {
    try {
      if (statSync(cand).isFile()) return cand
    } catch {
      // try the next candidate
    }
  }
  return null
}

interface Walk {
  files: Set<string>
  packages: Set<string>
  unresolved: string[]
  dynamic: Set<string>
}

function walk(file: string, acc: Walk = { files: new Set(), packages: new Set(), unresolved: [], dynamic: new Set() }): Walk {
  if (acc.files.has(file)) return acc
  acc.files.add(file)
  if (file.endsWith('.json')) return acc
  const src = readFileSync(file, 'utf8')

  // Dynamic imports are the boundary: record them, do not follow them.
  for (const m of src.matchAll(DYNAMIC_IMPORT)) acc.dynamic.add(m[1])

  for (const m of src.matchAll(STATIC_IMPORT)) {
    const spec = m[1]
    if (!spec.startsWith('.')) {
      acc.packages.add(spec)
      continue
    }
    const dep = resolveImport(file, spec)
    // Silence is the enemy here: an unresolvable import must fail the test, not
    // quietly drop a whole subtree from the scan.
    if (dep) walk(dep, acc)
    else acc.unresolved.push(`${file} -> ${spec}`)
  }
  return acc
}

describe('kid mode makes no network requests', () => {
  const acc = walk(ENTRY)

  it('resolves every relative import it finds', () => {
    expect(acc.unresolved).toEqual([])
  })

  it('reaches only offline modules', () => {
    for (const f of acc.files) {
      if (f.endsWith('.json')) continue
      const src = readFileSync(f, 'utf8')
      for (const [re, what] of FORBIDDEN) {
        expect(src, `${f} can reach the ${what}`).not.toMatch(re)
      }
    }
  })

  it('pulls in no npm package beyond preact', () => {
    const extra = [...acc.packages].filter((p) => !ALLOWED_PACKAGES.includes(p))
    expect(extra).toEqual([])
  })

  it('keeps the map, the API client and the speech input adapter behind a dynamic import', () => {
    const names = [...acc.files].map((f) => f.replace(/\\/g, '/'))
    expect(names.some((f) => f.endsWith('/places/map.ts'))).toBe(false)
    expect(names.some((f) => f.endsWith('/tutor/client.ts'))).toBe(false)
    expect(names.some((f) => f.endsWith('/speech/input.ts'))).toBe(false)
    // ...and that the networked half is loaded that way rather than not at all.
    expect([...acc.dynamic]).toContain('./pages')
  })

  it('speaks only with on-device voices', () => {
    // A remote speech synthesizer would send the phrase off the device, which
    // no FORBIDDEN pattern above would catch.
    const out = readFileSync(join(ROOT, 'speech', 'output.ts'), 'utf8')
    expect(out).toMatch(/localService/)
  })

  it('tells the parent how long to hold, in both languages', () => {
    // The Grown-ups button holds for HOLD_MS; kids_hold prints the seconds.
    const src = readFileSync(join(ROOT, 'pages', 'Ninos.tsx'), 'utf8')
    const ms = Number(/export const HOLD_MS = (\d+)/.exec(src)?.[1])
    expect(ms).toBeGreaterThan(0)
    const secs = String(ms / 1000)
    expect(STRINGS.en.kids_hold).toContain(secs)
    expect(STRINGS.es.kids_hold).toContain(secs)
  })

  it('scans the ninos directory too, if it ever exists', () => {
    const dir = join(ROOT, 'ninos')
    if (!existsSync(dir)) return
    const stack = [dir]
    while (stack.length) {
      const d = stack.pop()!
      for (const e of readdirSync(d, { withFileTypes: true })) {
        const p = join(d, e.name)
        if (e.isDirectory()) stack.push(p)
        else {
          const src = readFileSync(p, 'utf8')
          for (const [re, what] of FORBIDDEN) expect(src, `${p} can reach the ${what}`).not.toMatch(re)
        }
      }
    }
  })
})
