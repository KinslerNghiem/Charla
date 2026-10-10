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

- **Rehearse**: twenty-three scenes (counter and phone), an AI partner, corrections
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

