# Submission drafts

The portal closes **Monday, October 26, 2026, 12:00 pm ET**. Plan: submit Friday
October 23. These are drafts of the written answers; check the exact question
wording in the portal when registration opens and trim to its character limits.
Everything in here is true of the app as of the date at the bottom; update the
numbers (scenes, places, tests) before pasting.

Facts to keep straight:

- 20,546 people in Aurora and 1,435 in Naperville speak Spanish at home and
  speak English less than "very well" (ACS 2020–24, table C16001). DuPage
  County: 37,024. Will County: 32,738.
- Naperville sits in three congressional districts (IL-06, IL-11, IL-14). The
  team's district is decided by home address (ZIP+4), not by the school.

---

## 1. What inspired you to create this app?

Every language app we tried teaches you words. None of them gets you through
the thirty seconds at the pharmacy counter when the person says "date of
birth?" too fast and there is a line behind you. We live in Naperville, next to
Aurora, where more than twenty thousand people speak Spanish at home and are
still working on their English. Some of them are our neighbors, our parents'
coworkers, and the adults who pick up kids at our schools. The hard part for
them is not vocabulary. It is the first real conversation, and not knowing which
counter will be patient.

So we built Charla around one loop: rehearse one specific conversation with a
partner that stays at your level, get a card with your three phrases, and open
a map of real places nearby that told us they would be patient with you. Then
go. After the visit, one tap makes the map better for the next person.

We also wanted the app to be honest about kids. Our younger siblings would use
this, and an app for a nine-year-old should not phone home. So the under-13
mode sends nothing anywhere, and we built it so that is enforced by the code,
not by a promise.

## 2. What does your app do?

Charla is a conversation-practice app for Spanish speakers learning English
(and English speakers learning Spanish) in Naperville and Aurora, Illinois.

- **Rehearse.** Ten scenes, most tied to a real place you can walk into: a
  pharmacy refill, a clinic front desk, the driver-services window, the school
  office, a taquería order, a library card, a deli counter, an ice cream shop,
  and two phone calls, asking a landlord for a repair and calling in sick to
  work. An AI partner plays the person on the other side and stays at your
  level (three bands; the server measures every reply against the band and
  asks for a rewrite if it drifts). Corrections come inside the reply; a
  "Simpler" button drops a level. Typing always works. Speaking is one tap:
  talk, pause, and the reply comes back read aloud.
- **Go Card.** Your three phrases, the reply to expect, and one line to show the
  staff. It opens in airplane mode.
- **Places.** A map of businesses and public programs that said yes, with a
  per-language badge earned from visitors' anonymous one-tap reports. Places,
  never people: no user coordinates are stored, and the report id is salted per
  place so one visitor's taps cannot be joined into a trail.
- **Table mode.** One phone between two people who are already together: ten
  scripted minutes, half in each language, a timer, prompts, and a help box.
  Nothing is recorded.
- **Charlita.** The under-13 mode. Picture-based scripted scenes, stickers, and
  the phone's own voice reading lines aloud. No account, no location, no
  microphone, no AI, no network.

It is a progressive web app: installed from Safari it is the iOS app, and it
works on Android and on a laptop from the same code.

## 3. What technical difficulties did you face, and how did you overcome them?

**Keeping the AI at the learner's level.** A model will happily answer a
beginner with a paragraph. We wrote level bands (max words per sentence, max
sentences, max questions) as plain code, check every reply on the server, and
re-request once with the specific violation named. The prompt says the rule; the
code enforces it.

**Speech on an installed iOS web app.** Safari's speech recognition works in a
tab and silently does nothing once the app is installed to the home screen. We
built a four-tier input adapter that detects the situation at runtime and falls
back to recording a clip for a server transcription route, and finally to
typing, which always works and is the default in the demo.

**Making "kid mode collects nothing" true rather than promised.** The
networked half of the app (map, API client, the pages that use them) lives
behind a dynamic import that only runs for teen and adult modes. A test walks
the import graph from the app shell and fails if kid mode can reach any of it.
We then confirmed it in a real browser by watching every request kid mode
makes: only the app shell and the kids module load.

**Reports that help the map without tracking the reporter.** Each "I went"
carries a hash of (device id + place id), so the same phone gets a different
hash at every place and the rows cannot be joined into an itinerary. The public
endpoint returns only counts in 30-day buckets. Duplicate taps are rejected by a
database unique index rather than by logic that could drift.

**Compiling for the first time.** We wrote much of the app before Node was set
up, so the first compile found a filename collision (`Gate.tsx` next to
`gate.ts`, which Windows treats as the same file) and a test whose "acceptable"
sentence broke the band it was testing. Both were fixed the same afternoon, and
the lesson was to compile early.

## 4. What improvements would you make in a 2.0 version?

- Speech inside the installed iOS app by default (the transcription route is
  written; it needs the hosting account's speech model turned on).
- More scenes, chosen with the people who use them: the utility bill, the
  landlord call, the parent-teacher conference itself.
- A "verified by a visit" badge earned when someone on the team has been to the
  place, alongside the crowd badge.
- Other language pairs. The scene cards are language-neutral JSON, so a
  Polish–English or Arabic–English edition is content work, not code.
- Real tandem matching, but only the way the plan says: adults, a public place,
  the app mediating the first meeting, and nothing stored about who met whom.

## 5. What programming languages and tools did you use?

**Languages:** TypeScript (app and server), Python (content validators and the
venue pipeline), SQL (the reports database), HTML and CSS.

**Tools:** Vite and Preact for the app; vite-plugin-pwa for the installable
build; MapLibre GL with OpenFreeMap tiles for the map; Cloudflare Workers, D1
and KV for the API; Cloudflare Workers AI for the practice partner (the
open-weight gpt-oss-120b model) and for speech-to-text (Whisper), with the
Anthropic API (Claude) as a drop-in when a key is configured; Vitest and
Playwright for tests and screenshots; the U.S. Census Bureau geocoder for
addresses; Git and GitHub with a CI workflow that runs every check on every
push.

## 6. How did you use AI?

Two ways, both disclosed in `AI-USE.md` in the repository.

**Inside the app:** a language model plays the person behind the counter in
Rehearse and answers the help box in Table mode, and a speech model turns the
learner's voice into text, which is discarded after transcription. At
submission the partner runs on gpt-oss-120b on Cloudflare Workers AI; the
same code runs on Claude when an API key is present. Everything around the
model is ours: the scene format, the level bands and the drift guard, the
reply-language and whose-line checks, the safety handling, the daily caps,
the offline fallback, and the kid mode, which uses no AI at all.

**Building the app:** we used Claude Code as a coding assistant. The log in
`AI-USE.md` records each session and what it produced. We reviewed every file,
and we can explain every file; the judges are welcome to ask.

---

## Video (1 to 3 minutes, public link)

Storyboard from the plan page. Shoot vertical on a phone, in the light,
outside a real place on the map. No music over voice.

| Time | Shot | Line |
|------|------|------|
| 0:00 | Team outside a pharmacy | "Every language app teaches you words. None of them gets you through this door." |
| 0:12 | Screen: picker → pharmacy scene, one typed turn, the tip | "Charla rehearses one real conversation, at your level." |
| 0:40 | Screen: Simpler button, the reply shrinks | "If it's too much, one tap makes it simpler. The server checks every reply." |
| 0:55 | Screen: Go Card in airplane mode | "Your three phrases and one line to show the staff. Works with no signal." |
| 1:10 | Screen: map, tap a place, the badge | "Real places nearby that said they'd be patient. Places, never people." |
| 1:30 | Real counter, the staff line shown on the phone | (the conversation, subtitled) |
| 1:50 | Screen: "I went" tap, the thank-you | "One tap, anonymous, and the map gets better for the next person." |
| 2:05 | Kid with the phone, Charlita | "For kids under 13 there's Charlita. It sends nothing. We built it so it can't." |
| 2:25 | Team, one line each on what they built | |
| 2:45 | Title card: Charla, GitHub link, "Built in Naperville for the 2026 Congressional App Challenge" | |

## Checklist before submitting

- [ ] Every team member registered in the portal, district confirmed by ZIP+4
- [ ] Video public (YouTube or Vimeo), under 3 minutes, no copyrighted music
- [ ] Six answers pasted, within limits, AI disclosure included
- [ ] Repository public or a zip ready if the judges ask for code
- [ ] `AI-USE.md` up to date
- [ ] App deployed and the link in the form opens on a phone
- [ ] Places on the map: every business row has a signed one-pager on file

Drafted 2026-09-11.
