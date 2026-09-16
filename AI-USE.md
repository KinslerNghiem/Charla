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
- **Speech to text** (`/api/stt`, optional): a push-to-talk clip from the
  "Tap to talk" button, in any browser, is transcribed by Workers AI's Whisper model
  and discarded. The transcript goes into the text box for the learner to check
  before sending.
  Off until the `[ai]` binding is enabled.
- **When no Anthropic key is configured** (`worker/src/fallback.ts`), both of
  the above run instead on Cloudflare Workers AI's Llama 3.3 70B model, with
  the same prompts, the same JSON schema and the same level checker. The
  submission states which model was live at submission time.
- No AI in kid mode. No AI in the map, the reports, or the Go Card.

## AI-assisted coding

| Date | What | Tool |
|------|------|------|
| 2026-09-07 | Initial scaffold: project layout, first scene cards, Worker routes, tests, venue pipeline | Claude Code |
| 2026-09-08 | Three more scene cards (clinic, driver services, grocery deli) drafted and reviewed for Spanish and pedagogy | Claude Code |
| 2026-09-08 | Code audit standing in for a compiler (Node not installed yet); 43 verified findings applied by hand: zod v4 import, history/token/cap fixes in the Worker, per-place report salting, dynamic-import split for kid mode | Claude Code |
| 2026-09-11 | First compile and test run; fixes for what the compiler found; map lazy-load; Worker smoke test; school-office scene | Claude Code |
| 2026-09-16 | Free-tier partner fallback on Workers AI (Llama 3.3) for when no Anthropic key is set; tested live, then hardened with a reply-language check, a whose-line check and a filter for "ignore your rules" turns; deploy script | Claude Code |
| 2026-09-11 | First browser pass (screenshot walk script) and the fixes it prompted: Enter-to-send, honest 503 fallback, table timing, tab overflow; `/api/stt` on Workers AI; Pages security headers; drafts of the submission answers and the bilingual partner one-pager | Claude Code |
| 2026-09-12 | Ice cream shop kid scene; PNG icons for iOS/Android; offline check of the production build (Go Card, scenes, places, kid mode with the network off); contrast walk of every text node and the dark-mode fix it found; done-state fix for finished scripted scenes | Claude Code |

Add a row whenever an AI tool writes or substantially rewrites code, content or
copy. Reviewing, understanding, and being able to explain every file is on us.
