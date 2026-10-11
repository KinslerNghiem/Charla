# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Spanish speakers in Naperville and Aurora, Illinois, most of them Mexican-American adults, who speak English less than "very well" and have a real errand ahead of them: a pharmacy counter, a clinic front desk, the driver-services window, the school office, a taquería, a library, a deli, the post office, a bank, the park district, the community college, a bus; or a phone call to a landlord, a boss, the electric company, a doctor's office, the school. They use the app at home the evening before, and again at the counter with the Go Card open.

Also, in the reverse direction, English speakers learning Spanish (same loop, languages swapped). Teens 13 to 17 get the full app minus the copy about meeting strangers. Children under 13 get Charlita, a scripted mode that never touches the network, often on a parent's phone handed over.

Judges of the 2026 Congressional App Challenge open it on a laptop in October and November 2026.

## Product Purpose

Charla gets a learner through the first real conversation, not through a vocabulary list. One loop: rehearse one specific conversation with an AI partner that stays at your level, take a Go Card with your phrases and the staff's first question, open a map of real places nearby that said they would be patient, go, and after the visit one tap makes the map better for the next person. Success is a learner who walks up to the counter and gets through it.

## Positioning

- The partner's level is enforced in code, not only in the prompt: every reply is measured on the server against the level band and re-requested once when it drifts, and the app says when that happened.
- The map is of places, never people: reports carry a hash salted per place, so one visitor's visits cannot be joined into a trail, and the API returns only counts.
- Kid mode is structurally offline: a test walks the import graph and fails the build if the kid path can reach the network, a map, a microphone or location.
- Every scene is a conversation the learner will actually have in these two towns, in both languages, with a scripted version that works with no signal.

## Operating Context

- Phones first: Android Chrome and iPhone Safari (installed to the home screen as a PWA). Often prepaid data. Laptops for judges and for the Table-mode pair.
- Three physical scenes: at home the night before (rehearsal, speaking aloud); at the counter, phone at arm's length, possibly in airplane mode (Go Card, the line to show the staff); on a table between two people for ten minutes (Table mode, half in each language).
- Noisy, bright places: a pharmacy, a bus, a school office. Dark mode exists for the evening at home.
- Everything that ships must work offline after the first load: scenes, Go Card, the scripted partner, kid mode, the cached place list. The map and the AI partner need a connection.

## Capabilities and Constraints

- 23 scenes (counter and phone), three level bands (A1, A2, B1), corrections inside the reply, a Simpler button, "Say it another way", a "Kept at your level" tag, a Go Card earned by using the phrases or after six turns.
- Typing always works. Speaking is one tap: record, pause, transcribe (Whisper on the Worker), send; the reply is read aloud by a neural voice from the Worker, with the phone's own voice as fallback. Mic coaching on distance and pace after each clip.
- Places: 14 verified public programs today (libraries, conversation groups, the community college, driver services, clinics); businesses appear only after signing the one-pager (none yet). Badges earned from one-tap "I went" reports, decaying over a year. MapLibre on OpenFreeMap tiles; a list that works without the map.
- Table mode: a ten-minute scripted tandem with a timer and an AI "help me say this" box.
- Charlita: kid scenes with picture choices and stickers, the phone's own voice, a hold-to-open grown-ups panel. No account, no location, no microphone, no AI, no network.
- Daily caps on the Worker per device and per IP; the app explains a cap, an outage and no connection as three different things.
- Stack: Preact, one hand-written stylesheet (src/style.css) with CSS custom properties for light and dark, Vite, a PWA with precaching, a Cloudflare Worker API. No Tailwind, no component library.
- Content Security Policy: fonts, scripts and styles only from the app's own origin; images also from the tile server. A self-hosted font file is allowed; a hosted font stylesheet is not.
- Data budget: nothing is fetched at runtime today beyond tiles and the API. Any bundled asset has to earn its bytes on a prepaid plan and be precached for offline use.
- Two languages with enforced string parity; every target-language line carries its lang attribute for screen readers.
- Terminology, in the interface: Rehearse / Ensayar, Go Card / Tarjeta, Places / Lugares, Table / Mesa, Kids / Niños (Charlita), the partner, a scene, your level, "Kept at your level", "I went".

## Brand Commitments

- Name: Charla. Tagline: "Practice the conversation. Then go have it." / "Practica la conversación. Luego, tenla de verdad."
- Voice: plain, warm, honest. The privacy copy says exactly what leaves the phone. Errors say what happened and what still works.
- Two languages as equals: every learner-facing line is shown as a pair, the target language and the learner's own, never one as an afterthought.
- Confirmed for this redesign (2026-10-11): nothing in the current look is binding; the two-circle mark, the system serif, and the emoji icon system may all be replaced if the direction earns it. Anti-references confirmed by the user: loud or busy screens; anything that makes the adult app look childish.

## Evidence on Hand

- 23 bilingual scene cards: src/content/scenes/*.json (titles, roles, goals, phrases, the staff's first question, scripted dialogue).
- 14 verified places: public/venues.geojson, built from data/venues.csv.
- Census figures on the About page (ACS 2020-24, table C16001): Aurora 20,546; Naperville 1,435; DuPage 37,024; Will 32,738.
- App icons: public/icons (the current two-circle mark). Screenshots of the current design: public/screenshots and .walk/.
- No testimonials, no partner businesses, no usage numbers. Do not invent any.

## Product Principles

1. One loop, one conversation: rehearse, card, go, report. Nothing on a screen competes with that step.
2. The partner stays at the learner's level, and the app is honest when it had to intervene.
3. Places, never people.
4. Say exactly what leaves the phone, and make the parts that do not need it work with no signal.
5. Two languages as equals.
6. Calm at the counter: readable at arm's length, in a bright noisy room, by a nervous person.

## Accessibility & Inclusion

- Readers with limited English or limited Spanish; the interface language follows the learner's own language and the partner speaks the other.
- Screen readers: per-line language attributes, live regions for replies and phase changes, a skip link, focus moved to the page on navigation without a visible ring on the region.
- Touch targets at least 44 px; form controls at least 16 px so iOS does not zoom.
- prefers-reduced-motion respected; light and dark schemes; text contrast at least 4.5:1 (an earlier contrast walk covered every text node).
- Children: no data collection at all in kid mode, by construction.
