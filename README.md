# Charla

**Practice the conversation. Then go have it.**
**Practica la conversación. Luego, tenla de verdad.**

A conversation-practice app for Spanish speakers learning English (and the
reverse) in Naperville and Aurora, Illinois, built for the 2026 Congressional
App Challenge. You rehearse one real conversation (pharmacy refill, taquería
order, clinic front desk, driver-services window, school office) with an AI
partner that stays at your level, get a Go Card with your three phrases, then
open a map of real places nearby that said they would be patient with you.
After the visit, one tap makes the map better for the next person.

- **Rehearse**: eight scenes, an AI partner, corrections inside the reply, a
  Simpler button, typing always works.
- **Go Card**: your phrases, the reply to expect, a line to show the staff.
  Opens in airplane mode.
- **Places**: hand-verified businesses and public programs with a per-language
  badge, earned from visitors' one-tap reports and decaying over a year. Places,
  never people: no user coordinates are stored, and the report id is salted per
  place so one visitor's reports cannot be joined into a trail.
- **Table mode**: one phone between two people, ten scripted minutes, half in
  each language. Not recorded.
- **Charlita**: under-13 mode that sends nothing and asks for nothing. No
  account, no location, no microphone, no AI, and the voice that reads lines
  aloud is the phone's own. The only thing it loads is the app itself: the
  networked half of the app lives behind a dynamic import, so a child's browser
  never downloads the map or the API client. `tests/ninos-offline.test.ts`
  walks the import graph and enforces that.

## Status

Live at https://charla-naperville.pages.dev. All five must-have scenes from
the plan (pharmacy refill, clinic front desk, driver-services window, school
office, taquería order) plus five extras (library card, grocery deli, ice
cream shop, landlord repair, calling in sick), four of them kid-enabled. The
Worker with the drift guard, `/api/stt` on Workers AI Whisper, the venue
pipeline with 15 geocoded seed places (one more awaiting coordinates), tests,
CI, security headers for Pages, and drafts of the submission answers and the
partner one-pager in `docs/`. Still to build: everything in the plan's week 3
onward (partners, real-user testing, the video).

Verified so far: `npm run typecheck` (app and Worker), `npm test` (40 tests),
`npm run build`, `wrangler deploy --dry-run`, a smoke test of every data
route against `wrangler dev` with a local D1 (reports, dedup, per-place
salting, the aggregate query, caps, size limits), and `npm run walk`: every
page screenshotted in Chrome at phone size, light and dark, with kid mode
watched at the network level (it loads the shell and its own module, nothing
else). Against the production build with the network switched off: the Go
Card renders identically, the scripted scenes and all places load, and kid mode
earns a sticker. Every rendered text node was checked for WCAG contrast in
both colour schemes. Not yet exercised: a real call to the Claude API (needs a
key), and voice on a phone.

## Stack

| Layer | What | Why |
|-------|------|-----|
| App | Vite + TypeScript + Preact, PWA via vite-plugin-pwa | One build; installed from Safari it is the iOS app |
| Map | MapLibre GL JS + OpenFreeMap tiles | Free, no key, no quota |
| API | Cloudflare Worker + D1 + KV | Free tier, never sleeps, holds every secret |
| AI | Claude `claude-opus-5` via `@anthropic-ai/sdk`, structured outputs; without a key, Workers AI gpt-oss-120b in JSON mode | Level-adaptive partner; the free path needs no card |
| Data | `data/venues.csv` → `scripts/build_venues.py` → `public/venues.geojson` | The spreadsheet is the source of truth |
| Tests | Vitest, plus two Python validators that run without Node | Strings parity, scene validity, drift guard, badges, gate, table script, kid-mode-offline |
| Screens | Playwright-core driving the installed Chrome | `npm run walk`: every page at phone size, kid-mode network watch |

Third-party services the app talks to at runtime: OpenFreeMap (map tiles), our
own Worker, and through it the Anthropic API. Nothing else. No analytics, no ad
or push SDKs.

## Run it

You need Node 22 or newer and Python 3.9 or newer.

```bash
npm install
python scripts/build_venues.py      # data/venues.csv -> public/venues.geojson
python scripts/check_scenes.py      # validates every scene card
npm test
npm run typecheck
npm run dev                          # app on http://localhost:5173
npm run walk                         # in a second terminal: screenshots every page into .walk/
```

`npm run walk` drives the Chrome or Edge already on the machine (no browser
download) and fails if a page throws, a request fails, or kid mode touches the
network. Look at the pictures; layout problems hide from tests.

The app works without the API (it falls back to the scripted scene). To run the
API locally:

```bash
# once
npm install -g wrangler && wrangler login
wrangler d1 create charla            # paste the id into worker/wrangler.toml
wrangler kv namespace create CAPS    # paste the id into worker/wrangler.toml
npm run worker:db                    # creates the tables
echo "ANTHROPIC_API_KEY=sk-ant-..." > worker/.dev.vars

# every time
npm run worker:dev                   # API on http://localhost:8787; vite proxies /api to it
```

Speech: "Tap to talk" records a clip (never more than 20 seconds), shows a
level meter while it listens, sends the clip to `/api/stt` (Workers AI Whisper,
discarded after transcription), and puts the words in the text box for the
learner to check before sending. Local `wrangler dev` proxies the AI binding to
the real service, so speech works in dev too once you are logged in.

Deploy, once, from PowerShell after `npx wrangler login`:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\deploy.ps1
```

It creates the remote tables and the Pages project, deploys the Worker, builds
the app pointed at the Worker's URL (and allows that URL in `public/_headers`),
uploads it, and prints both links. Re-running it is safe. Cloudflare Pages
serves the app; the Worker holds every secret.

**The partner without an API key.** With no `ANTHROPIC_API_KEY`, the Worker
runs the partner and the Table-mode helper on Workers AI's gpt-oss-120b
(`worker/src/fallback.ts`), which is on Cloudflare's free tier. Same prompts,
same JSON schema, same drift guard, plus two checks the free model needed that
Claude did not: the reply must be in the target language, and it must not be
the learner's own line. To switch to Claude at any time:

```bash
wrangler secret put ANTHROPIC_API_KEY --config worker/wrangler.toml
```

Set a spend limit in the Anthropic console first ($20 is plenty).

## Layout

```
src/
  app.tsx              shell, nav, mode switch (kid mode = only Charlita)
  gate/                neutral month/year birth screen -> kid | teen | adult
  i18n/                every UI string in en and es (parity test)
  content/             scene cards (JSON, both languages) + validator
  tutor/               level bands + drift guard, turn schema, API client, offline renderer
  speech/              push-to-talk adapter (4 tiers), read-aloud with voice filtering
  places/              badge logic (reports -> Unknown/Reported/Confirmed), map setup
  table/               the ten-minute tandem script
  pages/               Learn, Places, Card, Table, Ninos, Privacy
worker/src/            /api/turn, /api/help, /api/report, /api/places, /api/flag, /api/stt
data/venues.csv        the place list; scripts/build_venues.py builds the GeoJSON
docs/                  submission answer drafts, video storyboard, partner one-pager (en/es)
scripts/walk.mjs       screenshot every page in the local Chrome
tests/                 see Stack
```

## Adding content

- **A scene**: copy a JSON file in `src/content/scenes/`, keep both languages,
  add it to `index.ts`, run `npm test`. Scenes marked `"kid": true` appear in
  Charlita and need a `picture` on every choice.
- **A place**: add a row to `data/venues.csv` only after someone at the place
  said yes (or it is a public program). Roles and shifts, never names. Paste
  coordinates from the address (one-time), run `npm run venues`.
- **A string**: add it to both `en` and `es` in `src/i18n/strings.ts`.
- **The icon**: edit `public/icons/icon.svg`, run `npm run icons` to regenerate
  the PNGs (Safari ignores an SVG home-screen icon).

## Privacy, in one paragraph

Progress, phrases and practice transcripts stay on the device. Practice turns
go to our Worker to get a reply and are not stored. "I went" reports carry a
place id and a hash of (device id + place id), so the same visitor gets a
different hash at every place and the rows cannot be joined into an itinerary;
`/api/places` returns only counts, never an identifier. A reply you tap "Report
this reply" on is stored for 60 days so we can fix it, which the button says.
Kid mode sends nothing. Human-to-human sessions are never recorded. The map's
tiles come from OpenFreeMap, which sees your IP like any website. See
`AI-USE.md` for the AI disclosure the challenge requires.

## Team

Names, school, district. (Fill in.)
