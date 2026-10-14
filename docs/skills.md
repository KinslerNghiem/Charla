# Communication skills

Charla's scenes teach one errand each. The Skills section teaches the eight
moves that work in every errand: asking for a repeat, asking someone to slow
down, asking what something means, confirming a name, date or number, asking
a follow-up question, explaining a problem and asking for help, saying you
lack a word, and closing with the next step. This page explains how they are
defined, how the app recognizes them, and how they connect to the scenes.

## The data

`src/skills/skills.ts` holds the eight definitions. Each one has a name and a
plain explanation, an example exchange, two or three lines to say, one
sentence of feedback for the drill, two drill cues, and the scenes where the
skill comes up. Everything is authored in both languages, like a scene, and
the lines the learner says use usted: they are talking to staff.

```ts
{
  id: 'confirm',
  name: { en: 'Confirm names, dates and numbers', es: 'Confirmar nombres, fechas y números' },
  phrases: [{ en: "So that's Tuesday at ten thirty, right?", es: 'Entonces, el martes a las diez y media, ¿verdad?' }, …],
  drills: [{ cue: { en: "Your appointment is Monday the ninth at two o'clock.", es: 'Su cita es el lunes nueve a las dos.' }, hint: … }, …],
  scenes: ['doctor-appointment-call', 'post-office-package', 'parent-teacher-conference'],
}
```

Adding a skill means adding one object here and its patterns in the
classifier. Nothing in a scene file changes.

## Recognizing a skill

`src/skills/intents.ts` is a rule-based classifier a reader can check line by
line. There is one set of patterns per skill per language, written as the
things people actually say, run on folded text (lower-case, accents stripped).
Nothing is scored; a skill either shows in the words or it does not.

| Skill | Recognized from |
|---|---|
| repeat | repeat · say that again · again, please · pardon? · didn't catch that · repetir · otra vez · de nuevo · ¿cómo? · ¿mande? |
| slow_down | slower · more slowly · too fast · más despacio · más lento |
| clarify | what does … mean · what do you mean · I don't understand · which one? · qué significa · no entiendo · ¿cuál? |
| unknown_word | I don't know the word · how do you say · what's the word for · no sé la palabra · cómo se dice |
| problem | there's a problem · doesn't work · is broken · can you help · hay un problema · no funciona · ¿me puede ayudar? |
| next_step | so I come back … · I'll bring … · you'll call me … · see you on … · entonces regreso · mañana traigo · me llaman cuando · nos vemos |
| confirm | a check (right? · did you say · let me make sure · spell · ¿verdad? · ¿dijo…? · para confirmar) or a detail from the partner's last line said back as a question or after so / entonces |
| follow_up | a real question of two words or more, after the partner has spoken, that is none of the above |

The last two take the partner's previous line as context. For confirm, the
details worth echoing are numbers, times, days, months and names (a
capitalized word that does not open a sentence; "Dr." is a title, not a
sentence end). Follow-up is the loosest rule of the eight, on purpose: any
genuine further question counts, and the docs say so.

Three functions use the same patterns:

- `detectIn(text, lang, ctx)`: the skills in one language. The drill uses it,
  so a Spanish drill passes only when the skill was used in Spanish; the same
  skill in English comes back as "close, now in Spanish".
- `detectSkills(text, ctx)`: the skills in either language. The conversation
  uses it: a learner who writes "how do you say…" in their own language still
  used the skill.
- `asksForHelp(text)`: repeat, slow down or clarify in either language. This
  is what the conversation flow (`src/tutor/flow.ts`) calls a clarification,
  so the drill and the flow agree on what "asked for help" means.

The model also returns one `skill` with each turn. The Worker keeps it only
when it is one of the eight ids; the app adds it to the rule-based result when
the rules missed it. The rules decide alone when the model is down.

## The Skills page

`src/pages/Skills.tsx`, reached from the card at the top of the scene picker
(`#/skills`). The list shows the eight skills with their status tags. A skill
opens to its explanation, the example exchange with Listen buttons, the lines
to say, "Practice it", "Practice again later", and the scenes to use it in.

The drill is two cues. The partner's line appears and is read aloud; the
learner types or speaks; the classifier judges; one sentence of feedback
shows: the skill's own sentence on a hit, "you used the skill, now in
Spanish" when it came in the other language, or the lines to pick from on a
miss. "Use it in a scene" opens the scene with `?skill=<id>`.

## In the conversation

- Each learner line is classified against the partner's previous line. A line
  that used a skill gets a small tag under its bubble.
- The learner's own words count as **used** in that scene; one of the app's
  own lines (the Repeat and What does that mean? chips) counts as **tried**,
  because the words were not theirs.
- A scene opened from a skill shows one nudge in the brief: the skill's first
  line, with Listen.
- The end-of-scene summary lists the skills used and, if the focus skill never
  came up, says the conversation did not call for it this time, with a way back.

## Progress

One key, `charla.skills`, on the device: when each skill was last tried in
the drill, whether the learner marked it to practice again, and the last
twenty conversations it was used in. "Reset skills progress" on the Skills
page clears only this; "Clear everything" on the Privacy page clears it with
the rest. No accounts, points, rankings or streaks.

## Tests

- `tests/intents.test.ts`: three or more equivalent expressions per skill per
  language; ordinary lines and the scenes' own lines come back empty; a word
  inside another word does not count; confirm needs the detail and a check,
  in either language, and never credits a check in the other language; a
  question before the partner has spoken is not a follow-up; the drill's three
  verdicts; the model's vote.
- `tests/skills.test.ts`: the eight ids once each; every line the page shows
  as "say it like this" is recognized as its own skill in both languages; the
  plain requests never read as one another; the drill cues do not contain the
  skill; every related scene exists; progress round-trips and resets.
- `tests/render-i18n.test.ts`: the list, a skill, the drill and a scene opened
  from a skill render in both interface languages and both directions, with
  the other language marked.
- `worker/tests/turn-flow.test.ts`: an unknown skill from the model becomes
  "", a real one passes, and the prompt asks for it.
