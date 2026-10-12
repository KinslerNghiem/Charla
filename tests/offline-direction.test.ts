import { describe, expect, it } from 'vitest'
import { h } from 'preact'
import { render } from 'preact-render-to-string'
import { OfflineScene } from '../src/tutor/OfflineScene'
import { SCENES, kidScenes } from '../src/content/scenes'
import { choicesFor } from '../src/content/scene.schema'

// The scripted scene, as each kind of learner sees it. A Spanish speaker
// practicing English gets the English mistakes; an English speaker practicing
// Spanish gets the Spanish ones; both get the right answers. This is the whole
// of Charlita, so the kid scenes are checked one by one.

const decode = (s: string) => s.replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&')

function choiceTexts(html: string): string[] {
  return [...html.matchAll(/<span class="txt" lang="(?:en|es)">([^<]*)<\/span>/g)].map((m) => decode(m[1]))
}

describe('the scripted scene shows each direction its own choices', () => {
  const pharmacy = SCENES.find((s) => s.id === 'pharmacy-refill')!
  const start = pharmacy.offline_script.nodes[pharmacy.offline_script.start]

  it('Spanish speaker practicing English: English mistakes, no Spanish-direction answers', () => {
    const html = decode(render(h(OfflineScene, { scene: pharmacy, learning: 'en', native: 'es', onDone: () => {} })))
    const shown = choiceTexts(html)
    expect(shown).toEqual(choicesFor(start, 'en').map((c) => c.text.en))
    // A Spanish-direction wrong answer is a flawed Spanish line; it appears nowhere, not even as a gloss.
    for (const c of start.choices) if (c.for === 'es') expect(html, `leaked: ${c.text.es}`).not.toContain(c.text.es)
    expect(html).toContain('lang="en"')
  })

  it('English speaker practicing Spanish: Spanish mistakes, no English-direction answers', () => {
    const html = decode(render(h(OfflineScene, { scene: pharmacy, learning: 'es', native: 'en', onDone: () => {} })))
    const shown = choiceTexts(html)
    expect(shown).toEqual(choicesFor(start, 'es').map((c) => c.text.es))
    for (const c of start.choices) if (c.for === 'en') expect(html, `leaked: ${c.text.en}`).not.toContain(c.text.en)
    // The gloss under each Spanish choice is English, and marked as such.
    expect(html).toMatch(/class="sub" lang="en"/)
  })

  it('every kid scene offers an English-speaking child a wrong answer about Spanish in every step', () => {
    for (const s of kidScenes()) {
      for (const [id, node] of Object.entries(s.offline_script.nodes)) {
        const wrong = choicesFor(node, 'es').filter((c) => !c.best)
        expect(wrong.length, `${s.id}:${id}`).toBeGreaterThan(0)
        for (const c of wrong) {
          expect(c.for, `${s.id}:${id}`).toBe('es')
          // The tip an English-speaking child reads is in English and quotes the Spanish line to say.
          expect(c.tip!.en, `${s.id}:${id} ${c.text.es}`).toMatch(/[¿¡áéíóúñ]|"[^"]+"/)
        }
      }
    }
  })
})
