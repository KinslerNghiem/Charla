---
version: 1
slug: "src-app-tsx"
primary_target: "src/app.tsx"
related_targets: ["src/style.css","src/pages/Learn.tsx","src/pages/Card.tsx","src/pages/Places.tsx","src/pages/Table.tsx","src/pages/Ninos.tsx"]
---

# Surface: the app shell and every page (src/app.tsx, src/pages/*, src/style.css)

Scope: a replacement visual world for the whole app, all routes, light and dark, phone and laptop. Mode: Operate. Audience: a Spanish speaker in Aurora or Naperville the night before a counter visit and at the counter; the reverse direction; teens; children in Charlita. Job: pick the scene, rehearse, take the card, find the place, report. Constraints: every behaviour, route, string and test stays; nothing fetched at runtime beyond one self-hosted font family; emoji pictures remain content in kid mode; no loud or busy screens; nothing that reads as childish to adults.

## Direction contract

THESIS: Charla is the card you hand across the counter. The screen is a counter with laminated bilingual cards on it, and every line the learner must read at arm's length is set the way a card prints it. Refused: the chat-first lesson shell with a mascot and a green streak, and the cream-and-serif tutor look the app wore before.

OWN-WORLD: white laminate cards on a cool counter ground (#EEF1F4), flat, no shadows, no borders, 12px corners. Every card wears a band in the colour of the language it is for: river blue (#1E5FAE) for English, card red (#C8102E) for Spanish; the session's target language is the accent for every live state (active tab, selected row, recording, focus). Ink #1A1D21, secondary ink #5B6470, rules #D7DCE2. One typeface, Archivo: semi-condensed 600 for titles, card fields and every line said aloud; regular 400 and 600 for body, labels and controls. Drawn line icons at one stroke; no emoji in the adult app. The learner's own language always sits directly under the line it glosses, smaller, in secondary ink.

STORY: a nervous learner sees which counter this is, rehearses with a partner whose lines read like print on a card, watches the phrases tick, earns a card worth handing over, and finds the place that said yes. The app never shouts; the card does the talking.

FIRST VIEWPORT (phone 390x844): top bar with the card mark and "Charla", the language chip and the About chip. The three steps as one row of small cards, step one filled in the accent. "Pick a place". The group heading "Health", then scene cards one per row: a 36px band in the accent with the line icon, the title in semi-condensed 20px, its gloss in 14px secondary ink, a small "Phone call" or "Also in Charlita" tag where true. The bottom tab bar: white, hairline top, five line icons with labels, the active one in the accent. The primary action is the first scene card. Signature move: the language band, the same band on every card from the picker to the Go Card to a place on the map.

FORM: the laminated bilingual card, position 1 on the ordered grounded list (presented as the pick beside the assigned candidate 5, the bilingual weekly; the user chose the pick). Seed key 8e664fdb.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance.

## Unresolved

- The place-type line icons are authored in this build; if any read as unclear at 24px they are the first thing to revise.
- Kid mode inherits palette and type but keeps emoji pictures as content.
