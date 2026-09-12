# AI use log

The Congressional App Challenge rules require that all AI use be fully
disclosed and that AI not be the entirety of the technical work. This log is
kept from day one and pasted into the submission form.

## AI inside the app

- **Conversation partner** (`worker/src/tutor.ts`): Claude (`claude-opus-5`,
  Anthropic API) plays the person behind the counter. It receives the scene
  card and level rules as a system prompt and returns one JSON turn. Everything
  around it is ours: the scene format, the level checker and retry, the safety
  handling, the caps, the offline fallback, the kid mode (which uses no AI).
- **"Help me say this"** in Table mode (`worker/src/tutor.ts`): one Claude call
  that returns a phrase, a literal gloss and a tip.
- No AI in kid mode. No AI in the map, the reports, or the Go Card.

## AI-assisted coding

| Date | What | Tool |
|------|------|------|
| 2026-09-07 | Initial scaffold: project layout, first scene cards, Worker routes, tests, venue pipeline | Claude Code |
| 2026-09-08 | Three more scene cards (clinic, driver services, grocery deli) drafted and reviewed for Spanish and pedagogy | Claude Code |
| 2026-09-08 | Code audit standing in for a compiler (Node not installed yet); 43 verified findings applied by hand: zod v4 import, history/token/cap fixes in the Worker, per-place report salting, dynamic-import split for kid mode | Claude Code |
| 2026-09-11 | First compile and test run; fixes for what the compiler found; map lazy-load; Worker smoke test; school-office scene | Claude Code |

Add a row whenever an AI tool writes or substantially rewrites code, content or
copy. Reviewing, understanding, and being able to explain every file is on us.
