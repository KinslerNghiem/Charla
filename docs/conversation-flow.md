# How a rehearsal knows where it is

The partner is a language model playing the person behind the counter. It
does not decide whether the errand is done, which line the learner still has
to say, or what the end-of-scene summary says. Code does, and this page is
that code's explanation. It lives in `src/tutor/flow.ts`, with its tests in
`tests/flow.test.ts`, and both the app and the Worker run it.

## The objectives

Every scene already carries two or three must-use lines: the things the
learner has to get across ("I'm here to pick up a prescription for my
mother", "Her last name is … and her date of birth is …", "Should she take it
with food?"). Those lines are the objectives. Each one now carries `keys`, the
words that count as saying it in your own way, in both languages:

```json
{ "en": "I'm here to pick up a prescription for my mother.",
  "es": "Vengo a recoger una receta para mi mamá.",
  "keys": { "en": ["pick up", "prescription", "medicine", "medication", "refill"],
            "es": ["recoger", "receta", "medicina", "medicamento", "medicinas"] } }
```

An objective is covered when the learner says the line, says any key as a
whole word ("i want to pick up my mom's medicine" counts; "this" does not
count for "hi"), or the partner reports in its JSON that the learner's turn
accomplished it (`step`, which the Worker bounds to the scene's own lines). A
test checks that every line matches its own keys and no other line of the
same scene.

## The phases

```
START → GREETING → TASK → FOLLOW_UP → RESOLUTION → COMPLETE
                      ↘  CLARIFICATION  ↙
```

- **START**: nothing said yet.
- **GREETING**: the learner has spoken, no objective covered.
- **TASK**: one objective covered, usually the request itself.
- **FOLLOW_UP**: more than one covered, the staff is asking for details.
- **RESOLUTION**: every objective covered; waiting for the partner to close.
- **CLARIFICATION**: a side step. Entered when the learner asks for a repeat,
  simpler words or a meaning (typed in either language, or the chips), or
  presses Simpler. It remembers where it came from and returns there on the
  next real line, or further if that line covered something.
- **COMPLETE**: the success condition, in code: every objective covered and
  the partner closed the errand; or the partner closed it with at least half
  the objectives covered and two real turns said (the learner paraphrased);
  or ten real turns, and the scene wraps up with whatever was covered.

Phases only move forward, except through CLARIFICATION. A learner can cover
the objectives in any order.

## What the Worker does with it

The app sends `phase` and `done` with every turn. The Worker bounds both
(unknown phase becomes START, a malformed list becomes all-false) and writes
one line after the level reminder:

```
Flow note: phase FOLLOW_UP. Covered: 1 (the learner has already said these).
Still to cover: 2 "Her last name is …"; 3 "Should she take it with food?".
These are the LEARNER's lines, never yours. Ask the question that invites the
next missing one; a line that is itself a question is one only the learner
asks, so wait for it and do not answer it before they ask.
```

That last sentence earned its place: the first wording ("still to cover")
made the free model say the learner's question itself. At A1 the note adds
"one thing per turn". In CLARIFICATION it asks for the previous
line again, shorter and plainer, then the same question. The model also
returns `step`, `gloss` (its reply in the learner's own language) and
`suggest` (a line the learner could say next); the Worker clamps the step,
drops a gloss that is not in the learner's language, and drops a suggestion
that is not in the target language or is the partner's own line.

## A line nobody could answer

Two checks keep the partner from carrying on as if it had understood
nonsense. On the Worker, before any model call, `src/tutor/garbled.ts` catches
the shapes a real line never has (the same word three times running, numbers
standing in for words, a long "word" with no vowel, symbols outnumbering
letters) and answers with a fixed in-character line: "Sorry, I didn't catch
that. Could you say it again?" For nonsense made of real words the model sets
`understood` false, and the Worker enforces it: step 0, no skill, no close, no
correction. In the app such a turn moves nothing: the errand's state goes back
to before the line, no skill is credited, and the line stays on screen with
the partner's request under it.

## What the learner can do when lost

Under the composer, after any reply: Repeat, What does that mean?, Translate
(the gloss, shown only on request), Suggest a reply (the suggestion, with "Use
it" to put it in the box), Try that again (the last line back in the box, the
reply to it forgotten), plus the existing Simpler and Another way. None of
these restart the scene.

## The end of a scene

The summary is assembled from what the app observed, never from a score:

- what was communicated (the covered lines) and what was not,
- one strength, chosen in this order: all lines covered; asked for a repeat
  when needed; answered in full sentences (five words or more on average);
  kept going for four turns; followed every reply the first time,
- one thing to try, in this order: the first line not covered; the last tip
  the partner gave; fuller sentences (under four words on average); the next
  level, if none of the above and no clarification was needed; otherwise, go
  have it for real,
- "Redo the last exchange", and the Go Card.

## Timeouts

One model call may take 15 s (`MODEL_TIMEOUT_MS`); a turn is at most two
calls. The app gives a turn 35 s, then shows the scripted scene with a retry
button. A hung model is treated exactly like an unreachable one.

## Clarifications and the skills

What counts as "the learner asked for help" is decided in one place, the
skills classifier (`src/skills/intents.ts`): a request for a repeat, a slower
pace or a meaning, in either language. The flow calls it to enter
CLARIFICATION; the Skills drill calls it to judge an answer; the conversation
calls it to tag a learner line. The eight skills, how they are recognized and
how they connect to the scenes are explained in `docs/skills.md`.

