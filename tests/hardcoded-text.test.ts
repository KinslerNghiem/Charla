import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'

// Every word a learner reads comes from src/i18n/strings.ts or from the
// bilingual scene data. This walks the JSX of every component and fails on text
// typed straight into it, or into a label attribute, because that text would
// show up in English whatever language the learner chose. The TypeScript
// compiler does the parsing, so a brace in a string or a comment cannot fool it.

const ROOT = fileURLToPath(new URL('../src', import.meta.url))

// The first screen asks which language you speak before anything is known, so
// it is written in both languages on purpose.
const BILINGUAL_BY_DESIGN = ['gate/LangPick.tsx']

// Text that is the same in both languages, or is not a word: the app's name,
// the minute unit, and the two language names, which are written in themselves.
const ALLOWED_TEXT = new Set(['Charla', 'Charlita', 'min', 'English', 'Español'])

// Attributes a screen reader or a tooltip speaks.
const SPOKEN_ATTRS = new Set(['aria-label', 'aria-description', 'aria-placeholder', 'aria-roledescription', 'aria-valuetext', 'title', 'placeholder', 'alt'])

function tsxFiles(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) tsxFiles(p, out)
    else if (p.endsWith('.tsx')) out.push(p)
  }
  return out
}

/** Letters only, so "min" and " · min " are the same word. */
function word(text: string): string {
  return text.replace(/[^\p{L}]/gu, '')
}

export function hardcodedText(file: string): string[] {
  const src = readFileSync(file, 'utf8')
  const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const hits: string[] = []
  const visit = (n: ts.Node) => {
    if (ts.isJsxText(n)) {
      const text = n.text.trim()
      if (/\p{L}{2,}/u.test(text) && !ALLOWED_TEXT.has(word(text))) hits.push(`text "${text}"`)
    } else if (ts.isJsxAttribute(n) && n.initializer && ts.isStringLiteral(n.initializer)) {
      const name = n.name.getText(sf)
      if (SPOKEN_ATTRS.has(name) && /\p{L}/u.test(n.initializer.text)) hits.push(`${name}="${n.initializer.text}"`)
    }
    ts.forEachChild(n, visit)
  }
  visit(sf)
  return hits
}

describe('no text is typed straight into a component', () => {
  const files = tsxFiles(ROOT).filter((f) => !BILINGUAL_BY_DESIGN.includes(relative(ROOT, f).replace(/\\/g, '/')))

  it('scans the whole app', () => {
    expect(files.length).toBeGreaterThan(10)
  })

  for (const f of files) {
    it(relative(ROOT, f).replace(/\\/g, '/'), () => {
      expect(hardcodedText(f)).toEqual([])
    })
  }

  it('would catch a literal label and literal text', () => {
    // The scanner is only worth having if it fires. A throwaway file through the same path.
    const tmp = join(ROOT, '..', 'node_modules', '.charla-scan-probe.tsx')
    const { writeFileSync, unlinkSync } = require('node:fs') as typeof import('node:fs')
    writeFileSync(tmp, `export const P = () => <nav aria-label="Sections"><b>Hello there</b>{t('x')} · min</nav>\n`)
    try {
      expect(hardcodedText(tmp)).toEqual(['aria-label="Sections"', 'text "Hello there"'])
    } finally {
      unlinkSync(tmp)
    }
  })
})
