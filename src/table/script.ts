import type { Bi, Scene } from '../content/scene.schema'
import type { Lang } from '../i18n/strings'

// Table mode: one phone between two people who are already together. A scripted
// ten-minute tandem, half in each language, driven by a timer. This is the
// "mediate the first session" idea, shipped without matching anyone with anyone.

export interface Phase {
  id: string
  seconds: number
  lang: Lang
  title: Bi
  prompts: Bi[]
}

const ICEBREAKERS: Bi[] = [
  { en: 'What did you eat today?', es: '¿Qué comiste hoy?' },
  { en: 'Where were you born? What is it like there?', es: '¿Dónde naciste? ¿Cómo es ese lugar?' },
  { en: 'What do you do on Sundays?', es: '¿Qué haces los domingos?' },
  { en: 'What is one thing you like about this town?', es: '¿Qué es algo que te gusta de esta ciudad?' },
]

const WRAP: Bi = { en: 'One phrase you learned today. Say it out loud.', es: 'Una frase que aprendiste hoy. Dila en voz alta.' }

export function buildTableScript(scene: Scene): Phase[] {
  const topic: Bi[] = [
    scene.goal,
    ...scene.must_use.map((p) => ({ en: `Use: "${p.en}"`, es: `Usa: "${p.es}"` })),
    { en: 'Ask your partner what they would say.', es: 'Pregúntale a tu compañero qué diría.' },
  ]
  return [
    // These sum to exactly 600 s so the Start button's "10 min" is the truth.
    { id: 'ice-es', seconds: 110, lang: 'es', title: { en: 'Warm up, in Spanish', es: 'Calentamiento, en español' }, prompts: ICEBREAKERS },
    { id: 'topic-en', seconds: 180, lang: 'en', title: { en: `${scene.title.en}, in English`, es: `${scene.title.es}, en inglés` }, prompts: topic },
    { id: 'switch', seconds: 5, lang: 'es', title: { en: 'Switch: now in Spanish', es: 'Cambio: ahora en español' }, prompts: [] },
    { id: 'ice-en', seconds: 110, lang: 'en', title: { en: 'Warm up, in English', es: 'Calentamiento, en inglés' }, prompts: ICEBREAKERS },
    { id: 'topic-es', seconds: 180, lang: 'es', title: { en: `${scene.title.en}, in Spanish`, es: `${scene.title.es}, en español` }, prompts: topic },
    { id: 'wrap', seconds: 15, lang: 'en', title: { en: 'Wrap up', es: 'Cierre' }, prompts: [WRAP] },
  ]
}

export function totalSeconds(phases: Phase[]): number {
  return phases.reduce((n, p) => n + p.seconds, 0)
}

/** Which phase is active at `elapsed` seconds, and how many seconds remain in it. */
export function phaseAt(phases: Phase[], elapsed: number): { index: number; remaining: number } | null {
  let acc = 0
  for (let i = 0; i < phases.length; i++) {
    if (elapsed < acc + phases[i].seconds) return { index: i, remaining: acc + phases[i].seconds - elapsed }
    acc += phases[i].seconds
  }
  return null
}
