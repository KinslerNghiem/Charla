import type { Bi, Lang } from '../content/scene.schema'

// The eight communication skills: the moves that work in any conversation,
// whatever the errand. Each one is data, authored once in both languages and
// rendered three ways: the Skills page (explanation, example, phrases), the
// short practice drill (two cues the learner answers), and the live
// conversation, where src/skills/intents.ts recognizes the skill in what the
// learner typed or said. Shared with the Worker, so no DOM code here.
//
// Register: the learner is talking to staff, so every line they say uses
// usted; the explanations talk to the learner as tú. Spanish is the neutral
// Latin American Spanish used across the app.

export type SkillId = 'repeat' | 'slow_down' | 'clarify' | 'confirm' | 'follow_up' | 'problem' | 'unknown_word' | 'next_step'

export const SKILL_IDS: readonly SkillId[] = ['repeat', 'slow_down', 'clarify', 'confirm', 'follow_up', 'problem', 'unknown_word', 'next_step']

export function isSkillId(v: unknown): v is SkillId {
  return typeof v === 'string' && (SKILL_IDS as readonly string[]).includes(v)
}

/** One round of the drill: what the partner says, and a hint about what to do with it. */
export interface Drill {
  /** The partner's line, said in the language being practiced; the other side is its subtitle. */
  cue: Bi
  /** What the learner is being asked to do, in their interface language. */
  hint: Bi
}

export interface SkillDef {
  id: SkillId
  name: Bi
  /** One or two plain sentences on why and when. */
  what: Bi
  /** A realistic exchange: the partner's line, then the learner using the skill. */
  example: { partner: Bi; learner: Bi }
  /** Two or three lines the learner can say, each with its translation. */
  phrases: Bi[]
  /** The one sentence shown when the drill recognizes the skill. */
  done: Bi
  drills: Drill[]
  /** Scenes where this skill comes up naturally; every id must exist in src/content/scenes. */
  scenes: string[]
}

export const SKILLS: SkillDef[] = [
  {
    id: 'repeat',
    name: { en: 'Ask for a repeat', es: 'Pedir que repitan' },
    what: {
      en: 'When you miss a line, ask for it again. People at a counter talk fast and are used to being asked.',
      es: 'Si no captaste una frase, pídela otra vez. En un mostrador la gente habla rápido y está acostumbrada a que se lo pidan.',
    },
    example: {
      partner: { en: 'Your co-pay is twenty-five dollars, and the pharmacist will be with you shortly.', es: 'Su copago es de veinticinco dólares, y el farmacéutico le atiende en un momento.' },
      learner: { en: 'Sorry, could you repeat that, please?', es: 'Perdón, ¿me lo puede repetir, por favor?' },
    },
    phrases: [
      { en: 'Sorry, could you repeat that, please?', es: 'Perdón, ¿me lo puede repetir, por favor?' },
      { en: 'Could you say that again?', es: '¿Me lo puede decir otra vez?' },
      { en: 'Pardon? One more time, please.', es: '¿Cómo? Una vez más, por favor.' },
    ],
    done: { en: 'Clear and polite. A real clerk says it again without a second thought.', es: 'Claro y cortés. Quien atiende lo repite sin pensarlo dos veces.' },
    drills: [
      {
        cue: { en: 'The form goes to window three, then you come back here with the receipt and your ID.', es: 'El formulario va a la ventanilla tres, y luego regresa aquí con el recibo y su identificación.' },
        hint: { en: 'That was a lot at once. Ask to hear it again.', es: 'Fue mucho de una vez. Pide que lo repitan.' },
      },
      {
        cue: { en: 'Her appointment is on the fourteenth at eight forty-five with Dr. Okafor.', es: 'Su cita es el catorce a las ocho cuarenta y cinco con la doctora Okafor.' },
        hint: { en: 'You did not catch the time. Ask for the line again.', es: 'No captaste la hora. Pide la frase de nuevo.' },
      },
    ],
    scenes: ['pharmacy-refill', 'clinic-front-desk', 'driver-services-window'],
  },
  {
    id: 'slow_down',
    name: { en: 'Ask someone to slow down', es: 'Pedir que hablen más despacio' },
    what: {
      en: 'Asking for a slower pace is normal, not rude. One short request and the whole conversation gets easier.',
      es: 'Pedir que hablen más despacio es normal, no es de mala educación. Una petición corta y toda la conversación se vuelve más fácil.',
    },
    example: {
      partner: { en: "You'll need both forms and proof of address, and the fee is thirty dollars, cash or card.", es: 'Necesita los dos formularios y un comprobante de domicilio, y la cuota es de treinta dólares, en efectivo o con tarjeta.' },
      learner: { en: 'Could you speak a little more slowly, please?', es: '¿Podría hablar un poco más despacio, por favor?' },
    },
    phrases: [
      { en: 'Could you speak a little more slowly, please?', es: '¿Podría hablar un poco más despacio, por favor?' },
      { en: "Slower, please. I'm learning English.", es: 'Más despacio, por favor. Estoy aprendiendo español.' },
      { en: 'Sorry, more slowly, please?', es: 'Perdón, ¿más lento, por favor?' },
    ],
    done: { en: 'That works. Most people slow down and keep going.', es: 'Eso funciona. La mayoría baja el ritmo y sigue.' },
    drills: [
      {
        cue: { en: 'Okay, so you take this to the lab on the second floor, they call your name, and then you check out at the front.', es: 'Bueno, lleva esto al laboratorio en el segundo piso, le llaman por su nombre y después pasa a la recepción.' },
        hint: { en: 'Too fast. Ask for a slower pace.', es: 'Demasiado rápido. Pide que vaya más despacio.' },
      },
      {
        cue: { en: 'Your account number is at the top right, the due date is the twentieth, and the late fee is ten dollars.', es: 'Su número de cuenta está arriba a la derecha, la fecha de pago es el veinte y el cargo por retraso es de diez dólares.' },
        hint: { en: 'Three things in one breath. Ask them to slow down.', es: 'Tres cosas de un tirón. Pide que hable más despacio.' },
      },
    ],
    scenes: ['clinic-front-desk', 'electric-bill-call', 'bank-open-account'],
  },
  {
    id: 'clarify',
    name: { en: 'Ask what something means', es: 'Pedir una aclaración' },
    what: {
      en: 'When one word or one step is unclear, ask about that one thing. It is faster than guessing.',
      es: 'Cuando una palabra o un paso no queda claro, pregunta por eso en concreto. Es más rápido que adivinar.',
    },
    example: {
      partner: { en: "You'll need to bring a voided check.", es: 'Tiene que traer un cheque anulado.' },
      learner: { en: "Sorry, what does 'voided check' mean?", es: 'Perdón, ¿qué significa "cheque anulado"?' },
    },
    phrases: [
      { en: 'Sorry, what does that mean?', es: 'Perdón, ¿qué significa eso?' },
      { en: 'What do you mean by that?', es: '¿Qué quiere decir con eso?' },
      { en: "I don't understand. Which one?", es: 'No entiendo. ¿Cuál?' },
    ],
    done: { en: 'Good. Asking about the one thing you missed keeps the rest moving.', es: 'Bien. Preguntar por lo que no entendiste mantiene todo lo demás en marcha.' },
    drills: [
      {
        cue: { en: 'We need a proof of residency before we can issue the card.', es: 'Necesitamos un comprobante de domicilio antes de emitir la tarjeta.' },
        hint: { en: 'One word is new. Ask what it means.', es: 'Hay una palabra nueva. Pregunta qué significa.' },
      },
      {
        cue: { en: 'Please sign the consent form and initial here.', es: 'Firme el consentimiento y ponga sus iniciales aquí.' },
        hint: { en: 'Not sure what they want? Ask.', es: '¿No sabes qué te piden? Pregunta.' },
      },
    ],
    scenes: ['library-card', 'bank-open-account', 'driver-services-window'],
  },
  {
    id: 'confirm',
    name: { en: 'Confirm names, dates and numbers', es: 'Confirmar nombres, fechas y números' },
    what: {
      en: 'Say the detail back before you leave: the date, the time, the amount, the name. If you heard it wrong, this is when it gets fixed.',
      es: 'Repite el dato antes de irte: la fecha, la hora, la cantidad, el nombre. Si lo oíste mal, este es el momento de corregirlo.',
    },
    example: {
      partner: { en: 'We can see her on Thursday at three fifteen.', es: 'La podemos atender el jueves a las tres y cuarto.' },
      learner: { en: 'Thursday at three fifteen, right?', es: 'El jueves a las tres y cuarto, ¿verdad?' },
    },
    phrases: [
      { en: "So that's Tuesday at ten thirty, right?", es: 'Entonces, el martes a las diez y media, ¿verdad?' },
      { en: 'Let me make sure: forty dollars?', es: 'Para confirmar: ¿cuarenta dólares?' },
      { en: 'Could you spell the name, please?', es: '¿Me deletrea el nombre, por favor?' },
    ],
    done: { en: 'That is the habit that saves a wasted trip.', es: 'Ese es el hábito que evita un viaje en vano.' },
    drills: [
      {
        cue: { en: "Your appointment is Monday the ninth at two o'clock.", es: 'Su cita es el lunes nueve a las dos.' },
        hint: { en: 'Say the day and the time back to check them.', es: 'Repite el día y la hora para comprobarlos.' },
      },
      {
        cue: { en: 'The total is sixty-two dollars, and the package arrives in five days.', es: 'El total es de sesenta y dos dólares, y el paquete llega en cinco días.' },
        hint: { en: 'Check the amount or the days.', es: 'Confirma la cantidad o los días.' },
      },
    ],
    scenes: ['doctor-appointment-call', 'post-office-package', 'parent-teacher-conference'],
  },
  {
    id: 'follow_up',
    name: { en: 'Ask a follow-up question', es: 'Hacer una pregunta de seguimiento' },
    what: {
      en: 'The first answer is rarely the whole picture. One more question gets the detail you actually need: how long, how much, what next.',
      es: 'La primera respuesta casi nunca lo dice todo. Una pregunta más te da el detalle que de verdad necesitas: cuánto tarda, cuánto cuesta, qué sigue.',
    },
    example: {
      partner: { en: 'The prescription will be ready this afternoon.', es: 'La receta estará lista esta tarde.' },
      learner: { en: 'What time can I pick it up?', es: '¿A qué hora puedo pasar a recogerla?' },
    },
    phrases: [
      { en: 'How long will it take?', es: '¿Cuánto tiempo tarda?' },
      { en: 'How much does it cost?', es: '¿Cuánto cuesta?' },
      { en: 'Do I need to bring anything?', es: '¿Necesito traer algo?' },
    ],
    done: { en: 'Good question. Now you know something you would have had to come back for.', es: 'Buena pregunta. Ahora sabes algo por lo que habrías tenido que volver.' },
    drills: [
      {
        cue: { en: 'Yes, we have that class on Saturdays.', es: 'Sí, tenemos esa clase los sábados.' },
        hint: { en: 'Ask one more thing: the time, the cost or the place.', es: 'Pregunta una cosa más: la hora, el costo o el lugar.' },
      },
      {
        cue: { en: 'The repair person can come this week.', es: 'La persona de mantenimiento puede venir esta semana.' },
        hint: { en: 'Which day? What time? Ask.', es: '¿Qué día? ¿A qué hora? Pregunta.' },
      },
    ],
    scenes: ['park-district-signup', 'landlord-repair', 'college-language-classes'],
  },
  {
    id: 'problem',
    name: { en: 'Explain a problem and ask for help', es: 'Explicar un problema y pedir ayuda' },
    what: {
      en: 'Name the problem in one plain sentence, then ask for help. You do not need the perfect words, only clear ones.',
      es: 'Di el problema en una oración sencilla y luego pide ayuda. No necesitas las palabras perfectas, solo palabras claras.',
    },
    example: {
      partner: { en: 'How can I help you today?', es: '¿En qué le puedo ayudar?' },
      learner: { en: "There's a problem with my bill. Can you help me, please?", es: 'Hay un problema con mi factura. ¿Me puede ayudar, por favor?' },
    },
    phrases: [
      { en: "There's a problem with my order.", es: 'Hay un problema con mi pedido.' },
      { en: "This doesn't work. Can you help me?", es: 'Esto no funciona. ¿Me puede ayudar?' },
      { en: 'I need help with this form, please.', es: 'Necesito ayuda con este formulario, por favor.' },
    ],
    done: { en: 'Plain and polite. That is all it takes to get help started.', es: 'Sencillo y cortés. Con eso basta para que empiecen a ayudarte.' },
    drills: [
      {
        cue: { en: "Good morning, maintenance. What's going on?", es: 'Buenos días, mantenimiento. ¿Qué pasa?' },
        hint: { en: 'Say what is broken, then ask for help.', es: 'Di qué está descompuesto y luego pide ayuda.' },
      },
      {
        cue: { en: 'Next, please. What do you need?', es: 'El que sigue, por favor. ¿Qué necesita?' },
        hint: { en: 'Name the problem in one sentence.', es: 'Di el problema en una oración.' },
      },
    ],
    scenes: ['landlord-repair', 'electric-bill-call', 'urgent-care-symptoms'],
  },
  {
    id: 'unknown_word',
    name: { en: "Say you don't know a word", es: 'Decir que no sabes una palabra' },
    what: {
      en: "Missing a word is not a dead end. Say you don't know it, describe it, or ask how to say it. The other person fills it in.",
      es: 'Que te falte una palabra no es el final. Di que no la sabes, descríbela o pregunta cómo se dice. La otra persona la completa.',
    },
    example: {
      partner: { en: 'Anything else today?', es: '¿Algo más por hoy?' },
      learner: { en: "I don't know the word in English. For a sore throat, the little candies.", es: 'No sé la palabra en español. Para la garganta, los dulcecitos.' },
    },
    phrases: [
      { en: "I don't know the word in English. It's for…", es: 'No sé la palabra en español. Es para…' },
      { en: 'How do you say that in English?', es: '¿Cómo se dice eso en español?' },
      { en: "Sorry, what's the word for this?", es: 'Perdón, ¿cuál es la palabra para esto?' },
    ],
    done: { en: 'That is exactly how fluent people handle a missing word.', es: 'Así es justo como la gente con fluidez resuelve una palabra que le falta.' },
    drills: [
      {
        cue: { en: 'What are you looking for today?', es: '¿Qué busca hoy?' },
        hint: { en: 'Pretend you lack the word. Say so, and describe it.', es: 'Imagina que te falta la palabra. Dilo y descríbela.' },
      },
      {
        cue: { en: 'Which part needs fixing?', es: '¿Qué parte hay que arreglar?' },
        hint: { en: 'Say you do not know the word, then describe it.', es: 'Di que no sabes la palabra y luego descríbela.' },
      },
    ],
    scenes: ['grocery-deli', 'landlord-repair', 'pharmacy-refill'],
  },
  {
    id: 'next_step',
    name: { en: 'Close with the next step', es: 'Cerrar con el siguiente paso' },
    what: {
      en: 'Before you say goodbye, say what happens next in your own words: when you come back, what you bring, who calls whom.',
      es: 'Antes de despedirte, di con tus palabras qué sigue: cuándo regresas, qué traes, quién llama a quién.',
    },
    example: {
      partner: { en: "It'll be ready after four.", es: 'Estará lista después de las cuatro.' },
      learner: { en: 'So I come back after four today. Thank you!', es: 'Entonces regreso hoy después de las cuatro. ¡Gracias!' },
    },
    phrases: [
      { en: 'So I come back on Friday, right?', es: 'Entonces regreso el viernes, ¿verdad?' },
      { en: "I'll bring the form tomorrow.", es: 'Mañana traigo el formulario.' },
      { en: "Okay, you'll call me when it's ready?", es: 'Bueno, ¿me llaman cuando esté lista?' },
    ],
    done: { en: 'You leave knowing what happens next. That is the whole point.', es: 'Te vas sabiendo qué sigue. De eso se trata.' },
    drills: [
      {
        cue: { en: "We'll have it ready for you by Wednesday.", es: 'Lo tendremos listo para el miércoles.' },
        hint: { en: 'Say the next step back: when you return and what you do.', es: 'Repite el siguiente paso: cuándo vuelves y qué haces.' },
      },
      {
        cue: { en: 'You just need to bring the signed form back to this office.', es: 'Solo tiene que traer el formulario firmado a esta oficina.' },
        hint: { en: 'Say what you will do, in your own words.', es: 'Di qué vas a hacer, con tus palabras.' },
      },
    ],
    scenes: ['post-office-package', 'school-office', 'call-in-sick'],
  },
]

export function skillById(id: string | null | undefined): SkillDef | undefined {
  return id ? SKILLS.find((s) => s.id === id) : undefined
}

/** The skills that list this scene as a natural place to use them. */
export function skillsForScene(sceneId: string): SkillDef[] {
  return SKILLS.filter((s) => s.scenes.includes(sceneId))
}

/** A phrase in the language being practiced, for the drill's microphone to expect. */
export function phrasesIn(skill: SkillDef, lang: Lang): string[] {
  return skill.phrases.map((p) => p[lang])
}
