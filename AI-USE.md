# AI use log

The Congressional App Challenge rules require that all AI use be fully
disclosed and that AI not be the entirety of the technical work. This log is
kept from day one and pasted into the submission form.

## AI inside the app

- **Conversation partner** (`worker/src/tutor.ts`, `worker/src/fallback.ts`):
  a language model plays the person behind the counter. Live, with no API key
  configured, that model is OpenAI's open-weight **gpt-oss-120b on Cloudflare
  Workers AI**, called in JSON mode. When an `ANTHROPIC_API_KEY` is set on the
  Worker, the same code calls Claude (`@anthropic-ai/sdk`, structured outputs)
  instead; nothing else changes. The model receives the scene card and the
  level rules as a system prompt and returns one JSON turn. Everything around
  it is ours and is code, not prompt: the scene format, the level bands and the
  retry (the app shows "Kept at your level" when it fired), the reply-language
  check, the whose-line check, the fragment and narration guard, the Spanish
  and English safety filters, the meta-instruction filter (applied to the
  history too), the daily caps, the scripted fallback when the model cannot be
  reached, and the kid mode, which uses no AI.
- **"Help me say this"** in Table mode (same files): one model call that
  returns a phrase, a literal gloss and a tip.
- **Speech to text** (`/api/stt`): "Tap, then speak" records the learner
  through the Web Audio API, the app encodes a 16 kHz mono WAV, and the Worker
  sends it to Workers AI's **Whisper** model. The clip is discarded after
  transcription and the transcript is sent directly to the partner as the
  learner's turn. On a 503 the app falls back to the browser's own speech
  recognition where it exists, and typing always works.
- **The partner's voice** (`/api/tts`, `worker/src/tts.ts`): the reply is
  read aloud by a neural text-to-speech model on Workers AI, **Deepgram
  Aura-2** for the first clips of each day and **MeloTTS** after that, and the
  audio is sent back to the caller. Nothing is kept; only lines that ship with
  the app are cached. When the route says no, the phone's own voice reads the
  line instead. The mic coaching (closer, farther, slower, faster) is plain
  arithmetic on the recorded clip, not a model.

## AI-assisted coding

| Date | What | Tool |
|------|------|------|
| 2026-09-07 | Initial scaffold: project layout, first scene cards, Worker routes, tests, venue pipeline | Claude Code |
| 2026-09-08 | Three more scene cards (clinic, driver services, grocery deli) drafted and reviewed for Spanish and pedagogy | Claude Code |
| 2026-09-08 | Code audit standing in for a compiler (Node not installed yet); 43 verified findings applied by hand: zod v4 import, history/token/cap fixes in the Worker, per-place report salting, dynamic-import split for kid mode | Claude Code |
| 2026-09-11 | First compile and test run; fixes for what the compiler found; map lazy-load; Worker smoke test; school-office scene | Claude Code |
| 2026-09-11 | First browser pass (screenshot walk script) and the fixes it prompted: Enter-to-send, honest 503 fallback, table timing, tab overflow; `/api/stt` on Workers AI; Pages security headers; drafts of the submission answers and the bilingual partner one-pager | Claude Code |
| 2026-09-12 | Ice cream shop kid scene; PNG icons for iOS/Android; offline check of the production build (Go Card, scenes, places, kid mode with the network off); contrast walk of every text node and the dark-mode fix it found; done-state fix for finished scripted scenes | Claude Code |
| 2026-09-16 | Free-tier partner fallback on Workers AI (Llama 3.3) for when no Anthropic key is set; tested live, then hardened with a reply-language check, a whose-line check and a filter for "ignore your rules" turns; deploy script | Claude Code |
| 2026-09-18 | Grammar bench of three free Workers AI models; switched the no-key partner to gpt-oss-120b; one-tap speaking (auto-stop on a pause, auto-send); one language question replaces the two header switches; WAV built in the app after an iPhone clip was rejected on the live site | Claude Code |
| 2026-09-24 | Landlord-repair and call-in-sick phone scenes; safety-filter tests; submission draft brought in line with the app as built | Claude Code |
| 2026-10-01 | Fourteen-lens audit of the whole app with adversarial verification of every finding (each claimed bug reproduced or dropped) | Claude Code |
| 2026-10-02 | The fixes from that audit, in six parallel passes: partner quality guards (level retry, fragments, whose-line, language, meta-instructions in history, 503 instead of a canned reply); speech lifecycle (one tap per turn, 15 s timeout, mic released on navigation, TTS hushed first, browser recognition only after a 503); Places data hygiene (team notes out of the GeoJSON, online groups marked, selection flies the map) and the offline map state; About page; PWA caching (map and places runtime-cached, update prompt); content fixes and three scenes (parent-teacher conference, electric-bill call, classroom help); docs; Worker, storage, language and router tests | Claude Code |
| 2026-10-03 | Visual design pass: serif display voice, brand mark, bottom tab bar on phones, icon scene cards in a grid, numbered phrases, segmented level picker, mic-first composer, Go Card laid out as a card, storefront awnings in kid mode, two-column scene page on laptops | Claude Code |
| 2026-10-05 | Neural voice for the partner (/api/tts on Workers AI: Aura-2 then MeloTTS, device voice fallback, edge cache for shipped lines); Android device-voice fix; mic coaching on distance and pace; navigation: tabs in loop order, header language and About chips, three-step strip, folding brief, scroll-to-top on route change; end-to-end voice check script | Claude Code |
| 2026-10-06 | The neural voice reads every tappable line outside kid mode (brief phrases, scripted scene, Go Card); tidier row under the composer; footer de-duplicated | Claude Code |
| 2026-10-09 | Ten new scenes drafted with Claude Code (to be read through by the team for register and Mexican-Spanish wording before judging); four new place types; themed picker; rehearsed ticks and an "up next" link | Claude Code |
| 2026-10-11 | Bug pass over the app and the Worker, each finding checked against the code before it was fixed: a speech-cap 429 hid the typing composer behind the scripted scene although typed turns were still available (now a status line); the device voice was queued in the same tick as the cancel that silenced the previous line, which Chrome on Android drops (now waits a beat, with a test); the Go Card for a phone scene opened an empty "Home" or "Work" map filter; a turn is clamped in the app to the Worker's 600 characters so a pasted paragraph cannot push later requests over the body limit; the two college venues tied to the language-classes scene; ice cream shops allowed in the venue pipeline; this table repaired (a blank line had split it). Then a layout pass: every page and state screenshotted at four widths in light and dark with the API stubbed, plus a DOM check for overlapping text; fixed the focus ring that boxed the whole page after a route change, the composer covering the end of the brief when a scene opens, a stale microphone message under the composer, and the jammed buttons on the kid-mode grown-ups panel | Claude Code |
| 2026-10-11 | Visual redesign with the frontend-design and impeccable skills: PRODUCT.md written from the team's answers; a direction round (seed 8e664fdb) and the team's pick of "the laminated bilingual card"; a new stylesheet (cool counter ground, flat white cards, a language band on every card, the accent following the language being practiced), Archivo self-hosted under public/fonts (OFL) in place of the system serif, a drawn line-icon set in src/ui/Icon.tsx replacing emoji everywhere outside kid mode, a new app icon; every page re-shot at four widths in light and dark, the design detector run clean, an in-thread finish review, and DESIGN.md plus its sidecar recorded from the built result | Claude Code |

