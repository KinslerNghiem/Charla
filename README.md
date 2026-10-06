# Charla

**Practice the conversation. Then go have it.**
**Practica la conversación. Luego, tenla de verdad.**

A conversation-practice app for Spanish speakers learning English (and the
reverse) in Naperville and Aurora, Illinois, built for the 2026 Congressional
App Challenge. You rehearse one real conversation (pharmacy refill, taquería
order, clinic front desk, driver-services window, school office, a call to the
landlord) with an AI partner that stays at your level, get a Go Card with your
phrases and the first question the staff will ask, then open a map of real
places nearby that said they would be patient with you. After the visit, one
tap makes the map better for the next person.

- **Rehearse**: thirteen scenes (counter and phone), an AI partner, corrections
  inside the reply, a Simpler button, typing always works. Speaking is one tap:
  tap, talk, pause, and the words go straight to the partner.
- **Go Card**: your phrases, the staff's first question, the reply to expect,
  a line to show the staff. Opens in airplane mode.
- **Places**: public programs and hand-verified businesses with a per-language
  badge, earned from visitors' one-tap reports and decaying over a year. Places,
  never people: no user coordinates are stored, and the report id is salted per
  place so one visitor's reports cannot be joined into a trail. The list works
  without a connection; the map says so when it cannot draw.
- **Table mode**: one phone between two people, ten scripted minutes, half in
  each language. Not recorded.
- **Charlita**: under-13 mode that sends nothing and asks for nothing. No
  account, no location, no microphone, no AI, and the voice that reads lines
  aloud is the phone's own. The only thing it loads is the app itself: the
  networked half of the app lives behind a dynamic import, so a child's browser
  never downloads the map or the API client. `tests/ninos-offline.test.ts`
  walks the import graph and enforces that.

## Status

<!-- Re-check every number in this section before pasting it anywhere:
     scenes = `ls src/content/scenes/*.json | wc -l`, tests = the last line
     of `npm test`, places = the "wrote N places" line of `npm run venues`. -->

Live at https://charla-naperville.pages.dev, deployed YYYY-MM-DD from commit
`_______` (fill in after `scripts/deploy.ps1`; until then the live site may lag
`main`). Thirteen scenes: the five must-haves from the plan (pharmacy refill,
clinic front desk, driver-services window, school office, taquería order) plus
library card, grocery deli, ice cream shop, parent-teacher conference,
classroom help, and three phone calls (landlord repair, calling in sick, a
question about the electric bill). Five are kid-enabled. The Worker runs the
partner live on Workers AI with the level guard, the reply-language and
whose-line checks, a fragment guard, Spanish and English safety filters and
daily caps; `/api/stt` runs Whisper; the venue pipeline ships the public
programs that exist today, with businesses added as partners sign the
one-pager in `docs/partners.md`. An About page carries the idea, the ACS
numbers, how it works and the AI disclosure. Still on the team, not the code:
partner visits, a phone test of one-tap speech, the video, and filling in the
names (`src/contact.ts`, the About page, the Team section below).

Verified: `npm run typecheck` (app and Worker), `npm test` (139 tests across 21 files), `npm run build`, `python scripts/check_scenes.py`,
`wrangler deploy --dry-run`, and `npm run walk`: every page screenshotted in
Chrome at phone size, light and dark, in both interface languages, Places with
the network switched off, and kid mode watched at the network level (it loads
the shell and its own module, nothing else; any request to `/api/` or a tile
server fails the walk). Every rendered text node was checked for WCAG contrast
in both colour schemes. Voice has been exercised on a phone: an iPhone clip was
rejected by the transcription model on the live site, which is why the app now
builds its own WAV (`src/speech/input.ts`, `tests/wav.test.ts`). Not yet
exercised: a real call to the Claude API (needs a key; the code path is the
same).

## Stack

| Layer | What | Why |
|-------|------|-----|
| App | Vite + TypeScript + Preact, PWA via vite-plugin-pwa | One build; installed from Safari it is the iOS app |
| Map | MapLibre GL JS 6 + OpenFreeMap tiles | Free, no key, no quota; runtime-cached, never precached |
| API | Cloudflare Worker + D1 | Free tier, never sleeps, holds every secret |
| AI | Live: Workers AI `gpt-oss-120b` in JSON mode (`worker/src/fallback.ts`). With `ANTHROPIC_API_KEY` set: Claude via `@anthropic-ai/sdk`, structured outputs, no code change | Level-adaptive partner; the live path needs no card |
| Speech | Web Audio → 16 kHz mono WAV built in the app → `/api/stt` (Workers AI Whisper) | The same bytes from every browser; the phone's recorder was not |
| Data | `data/venues.csv` → `scripts/build_venues.py` → `public/venues.geojson` | The spreadsheet is the source of truth; team notes never leave it |
| Tests | Vitest (app, Worker and WAV encoder), plus two Python validators that run without Node | Strings parity, scene validity, level guard, badges, gate, table script, kid-mode-offline, storage, router, safety filters |
| Screens | Playwright-core driving the installed Chrome | `npm run walk`: every page at phone size, offline Places, kid-mode network watch |

Third-party services the app talks to at runtime: OpenFreeMap (map tiles), our
own Worker, and through it Cloudflare Workers AI (gpt-oss-120b for the partner,
Whisper for speech). The Anthropic API is called only when a key is configured
on the Worker. Nothing else. No analytics, no ad or push SDKs.

## Run it

You need Node 22 or newer and Python 3.9 or newer.

```bash
npm install
python scripts/build_venues.py      # data/venues.csv -> public/venues.geojson
python scripts/check_scenes.py      # validates every scene card (types come from the schema)
npm test
npm run typecheck
npm run dev                          # app on http://localhost:5173
npm run walk                         # in a second terminal: screenshots every page into .walk/
```

`npm run walk` drives the Chrome or Edge already on the machine (no browser
download) and fails if a page throws, a request fails, the offline notice is
missing on Places, or kid mode touches the network. Each section is isolated,
so one broken page costs one picture, not the walk. Look at the pictures;
layout problems hide from tests.

The app works without the API (a 503 drops the scene into scripted mode with a
retry). To run the API locally:

```bash
# once
npx wrangler login                   # wrangler is a devDependency; no global install
npm run worker:db                    # creates the tables in a local D1
echo "ALLOWED_ORIGIN=http://localhost:5173" > worker/.dev.vars   # the Worker refuses other origins
# optional: echo "ANTHROPIC_API_KEY=sk-ant-..." >> worker/.dev.vars
# optional: echo "TTS_SPEAKER_ES=estrella" >> worker/.dev.vars        # try an Aura voice by ear

# every time
npm run worker:dev                   # API on http://localhost:8787; vite proxies /api to it
```

The D1 id in `worker/wrangler.toml` is ours. A fork runs
`npx wrangler d1 create charla` once and pastes its own id there. Local
`wrangler dev` proxies the `[ai]` binding to the real service, so the partner
and speech work in dev too once you are logged in (and count against the free
tier).

Speech: "Tap, then speak" opens the microphone, shows a level meter while it
listens, stops itself after a pause (or on a second tap), encodes the samples
as a 16 kHz mono WAV in the app, posts it to `/api/stt` (Workers AI Whisper,
discarded after transcription) and sends the words straight to the partner as
the learner's turn. One tap per turn; there is no check box. Three tiers,
chosen at runtime: the recorder above wherever Web Audio exists; the browser's
own SpeechRecognition only as a fallback after `/api/stt` answers 503; typing,
always. The read-aloud voice is hushed before recording starts, a 15 s timeout
covers a stalled upload, and leaving the page releases the microphone.

The partner's voice: the reply is read by a neural voice from `/api/tts`
(`worker/src/tts.ts`), played through one audio element that a tap unlocks,
with the phone's own voice as the fallback when there is no connection, the
day's allowance is spent, or the browser refuses. Deepgram's Aura-2 reads the
first `DAILY_TTS_PREMIUM` clips of the day across everyone (the natural voice,
about 130 neurons a clip), MeloTTS the rest (about one neuron); lines that ship
with the app are cached at the edge, replies a learner shaped never are. Both
knobs and an optional `TTS_SPEAKER_ES` (Aura's Mexican-accent voices, e.g.
`estrella`) are in `worker/wrangler.toml`. Kid mode never loads this path; it
speaks through the device alone.

Coaching: the mic is opened with automatic gain control off, so the level is
honest, and the clip is boosted in the app before it is sent. After each spoken
turn one line says whether to move closer or farther from the microphone
(RMS and clipping of the loud part of the clip) and whether to slow down or
speed up (syllables per second over the spoken span; the thresholds and the
reasoning are in `src/speech/input.ts`). While the mic is open the same advice
about distance shows live.

```bash
node scripts/voicecheck.mjs path/to/sentence.wav   # the whole spoken loop in a real Chrome,
                                                   # with that WAV as the microphone
```

Deploy, once, from PowerShell after `npx wrangler login`:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\deploy.ps1
```

It creates the remote tables and the Pages project, deploys the Worker, builds
the app pointed at the Worker's URL (and allows that URL in `public/_headers`),
uploads it, and prints both links. Re-running it is safe. Cloudflare Pages
serves the app; the Worker holds every secret.

**The partner.** The Worker runs the partner and the Table-mode helper on
Workers AI's gpt-oss-120b (`worker/src/fallback.ts`), which is on Cloudflare's
free tier. Around the model sits the code that makes it usable for a learner:
the level bands with one retry (the UI shows "Kept at your level" when the
retry fired), a reply-language check, a whose-line check (the partner may not
speak the learner's own line), a guard against fragments and narration,
Spanish and English safety filters, and a filter for "ignore your rules" turns
that also runs over the history. When the model cannot be reached the Worker
answers 503 and the app shows the scripted scene with a retry, never a canned
reply pretending to be the partner. To switch to Claude at any time:

```bash
npx wrangler secret put ANTHROPIC_API_KEY --config worker/wrangler.toml
```

Same prompts, same JSON schema, same checks. Set a spend limit in the
Anthropic console first ($20 is plenty).

## Layout

```
src/
  app.tsx              shell, nav, mode switch (kid mode = only Charlita), update prompt
  contact.ts           CONTACT_EMAIL, PARTNERS_URL, REPO_URL: fill in before the freeze
  gate/                language question (LangPick), then month/year birth screen -> kid | teen | adult
  i18n/                every UI string in en and es (parity test); lang.ts holds the one language answer
  content/             scene cards (JSON, both languages) + validator
  tutor/               level bands + guard, turn schema, API client, offline renderer
  speech/              one-tap input (recorder -> WAV -> /api/stt, browser fallback, typed), read-aloud
  places/              badge logic (reports -> Unknown/Reported/Confirmed), map setup, ZIP centers
  table/               the ten-minute tandem script
  pages/               Learn, Places, Card, Table, Ninos, Privacy, About
worker/src/            /api/turn, /api/help, /api/report, /api/places, /api/flag, /api/stt; caps, safety
worker/tests/          Worker unit tests (routes, caps, fallback parsing, history, guards)
data/venues.csv        the place list; scripts/build_venues.py builds the GeoJSON (public columns only)
docs/                  submission answers, video storyboard, partner one-pager (en/es), next steps
scripts/walk.mjs       screenshot every page in the local Chrome
tests/                 see Stack
```

## Adding content

- **A scene**: copy a JSON file in `src/content/scenes/`, keep both languages,
  add it to `index.ts`, run `npm test` (or `python scripts/check_scenes.py`,
  which reads the allowed `place_type` values out of `scene.schema.ts` so the
  two never drift). Every scene carries `expect` (the staff's first question,
  shown on the Go Card) and `channel` (`counter` or `phone`). `must_use` holds
  two or three phrases, each one a full sentence the *learner* says, never the
  staff's line: the partner is checked against them. Scripted-mode distractors
  should be plausible errors, not jokes. Scenes marked `"kid": true` appear in
  Charlita and need a `picture` on every choice.
- **A place**: add a row to `data/venues.csv` only after someone at the place
  said yes (or it is a public program). Roles and shifts are free text
  ("cashier, afternoons"), never names; the tests fail on anything that looks
  like one. Look the address up once and paste `lat`,`lng`; set `format` to
  `in_person`, `online` or `both`; run `npm run venues`. Rows without
  coordinates are skipped loudly. `notes`, `source` and `verified_on` stay in
  the CSV and never reach the client.
- **A string**: add it to both `en` and `es` in `src/i18n/strings.ts`.
- **The icon**: edit `public/icons/icon.svg`, run `npm run icons` to regenerate
  the PNGs (Safari ignores an SVG home-screen icon).

## Privacy, in one paragraph

Progress, phrases and practice transcripts stay on the device. Practice turns
go to our Worker to get a reply and are not stored. A voice clip goes to the
Worker for transcription and is discarded. "I went" reports carry a place id
and a hash of (device id + place id), so the same visitor gets a different
hash at every place and the rows cannot be joined into an itinerary;
`/api/places` returns only counts, never an identifier. A reply you tap
"Report this reply" on is stored for 60 days so we can fix it, which the button
says. Daily caps count requests per device and per IP address as hashes salted
with the day, pruned the next day. Kid mode sends nothing. Human-to-human
sessions are never recorded. The map's tiles come from OpenFreeMap, which sees
your IP like any website. See `AI-USE.md` for the AI disclosure the challenge
requires.

## Team

<!-- Fill in before the freeze (Oct 18). Keep it to what the portal asks for.
     Each teammate's district is decided by home address, ZIP+4, not by the
     school; Naperville spans IL-06, IL-11 and IL-14. Check at house.gov. -->

- **Names**: ______, ______, ______
- **School**: ______
- **District**: IL-__ (by home ZIP+4; confirm for every teammate)
- **Contact**: the address in `src/contact.ts`
