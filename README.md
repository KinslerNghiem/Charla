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

- **Rehearse**: five scenes, an AI partner, corrections inside the reply, a
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

Week 1 done. All five must-have scenes from the plan (pharmacy refill, clinic
front desk, driver-services window, school office, taquería order) plus two
extras (library card, grocery deli), three of them kid-enabled. The Worker with
the drift guard, the venue pipeline with 15 geocoded seed places (one more awaiting
coordinates), tests, and
CI. Still to build: `/api/stt` for voice inside the installed iOS app, and
everything in the plan's week 3 onward.

Verified so far: `npm run typecheck` (app and Worker), `npm test` (36 tests),
`npm run build`, `wrangler deploy --dry-run`, and a smoke test of every
data route against `wrangler dev` with a local D1 (reports, dedup, per-place
salting, the aggregate query, caps, size limits). Not yet exercised: a real
call to the Claude API (needs a key), the app in a browser, and voice on a
phone.

## Stack

| Layer | What | Why |
|-------|------|-----|
| App | Vite + TypeScript + Preact, PWA via vite-plugin-pwa | One build; installed from Safari it is the iOS app |
| Map | MapLibre GL JS + OpenFreeMap tiles | Free, no key, no quota |
| API | Cloudflare Worker + D1 + KV | Free tier, never sleeps, holds every secret |
| AI | Claude `claude-opus-5` via `@anthropic-ai/sdk`, structured outputs | Level-adaptive partner; `claude-sonnet-5` is a one-line fallback |
| Data | `data/venues.csv` → `scripts/build_venues.py` → `public/venues.geojson` | The spreadsheet is the source of truth |
| Tests | Vitest, plus two Python validators that run without Node | Strings parity, scene validity, drift guard, badges, gate, kid-mode-offline |

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
```

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

Deploy: `npm run build` and point Cloudflare Pages at `dist/`;
`npm run worker:deploy` for the API, then `wrangler secret put ANTHROPIC_API_KEY
--config worker/wrangler.toml`. If the app and the Worker are on different
origins, set `VITE_API_BASE` at build time and `ALLOWED_ORIGIN` in
`wrangler.toml`. Set a spend limit in the Anthropic console ($100 is plenty).

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
