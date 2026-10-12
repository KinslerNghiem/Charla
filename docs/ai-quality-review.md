# The partner: what is checked by code, and what a person has to read

Charla's conversation partner is a language model playing the person behind the
counter. Three layers keep it honest. The first two run on every turn and in the
test suite; the third is a human job, and this page is its checklist.

## 1. Enforced in code, on every turn (worker/src/tutor.ts, levels.ts, style.ts, langcheck.ts)

| Check | What happens |
|---|---|
| Level band (sentences, words per sentence, questions) | One rewrite request, then the reply is kept; the app shows "Kept at your level" |
| Reply language | One rewrite request, then the redirect line instead of a partner in the wrong language |
| Praise for the learner ("great job", "muy bien dicho") | One rewrite request |
| Same opening word as the previous line, or the same line again | One rewrite request |
| Free model only: fragments, narration, the learner's own line | One rewrite request |
| Client-sent level outside A1, A2, B1 | Treated as A2 |
| A request to change language or rules | Never reaches the model; the redirect line |
| Simpler, Another way | A fixed line replaces whatever the client sent; the transcript is kept |
| Model unreachable | 503; the app plays the scripted scene |

Tests: `worker/tests/turn-flow.test.ts`, `prompt.test.ts`, `style.test.ts`, `fallback-problems.test.ts`, `history.test.ts`.

## 2. Asked for in the prompt (worker/src/prompt.ts), checked by the bench

`node scripts/convo-bench.mjs` runs four scripted conversations (both directions,
A1 and B1, with a recastable mistake, a code-switched line, a stuck moment and
the Simpler button) against a running Worker and writes `.bench/<stamp>.md`.
The flags in that file are the code checks above, re-run on the final replies.

## 3. Needs a bilingual reader

Read a bench transcript, or a conversation from a phone, and score each line.
These cannot be judged by code, and a pass here is a human's opinion, not a
test result.

| Question | Pass looks like | Fail looks like |
|---|---|---|
| Does it sound like the person at that counter? | "Claro, ¿necesita algo para el dolor de cabeza?" | "I understand that you require medication." |
| Did it recast the mistake inside the answer? | Learner: "mi cabeza dolor" → partner says "dolor de cabeza" and moves on | A grammar explanation, or the mistake repeated back |
| Did it leave small slips alone? | One correction at most, and not every turn | Every turn corrects something |
| Did it leave regional forms alone? | "carro", "aplicar", "vos" pass without comment | A tip "corrects" them |
| Stuck learner (writes in their own language) | Answer in the target language, simplest words, the needed line in `alt` | A reply in the learner's language |
| Code-switched word ("mi mother") | Recast with the target word, no comment on the switch | A language lecture, or a switch of language |
| Simpler | Same meaning, easier words, same language, the same question again | A translation, or a new topic |
| Follow-up questions | The question a real clerk asks next | A generic "anything else?" every turn |
| B1 only | One ordinary complication, handled kindly | None, or several, or one at A1 |
| Tone | Patient, no praise, no exclamation marks in a row | "Great job!", "Perfect!" |
| Spanish variety | Neutral Latin American, usted at the counter | "vale", "vosotros", tú to a stranger |
| Close | Warm, in character, when the goal is actually reached | Early "goal reached" to be nice |

Record findings in AI-USE.md with the date and the bench file name. Anything that
fails twice goes into the prompt or, better, into a code check with a test.
