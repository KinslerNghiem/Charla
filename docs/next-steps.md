# Next steps

Written 2026-10-02, the day of the audit pass. Dates below are from the 2026
rules: portal closes **Monday October 26, 12:00 pm ET**.

## Done in this pass

Everything below came out of a 14-lens audit (correctness, security,
privacy, accessibility, Spanish quality, pedagogy, speech, offline, places,
tests, docs, code quality, performance, and a judge's first three minutes),
with every finding re-verified against the code before it was fixed.

**Partner quality** (why the AI "didn't always respond correctly")

- A Workers AI outage used to come back as a canned "Let's get back to the scene" line; it is now a 503, so the app drops to the scripted scene with a retry.
- The whose-line check only applies to full learner sentences, so the partner can again say "For here or to go?" or "prescription".
- A fragment guard catches the free model's A1 habits ("I find it. What name?") and asks for a rewrite; the prompt carries those exact wrong/right pairs.
- Short Spanish replies with "a" ("Vamos a ver.") are no longer misread as another language; "Dr." and "Sra." no longer count as sentence ends.
- Safety and meta filters work in Spanish too, no longer trip on "instructions for the medicine", and a meta turn cannot ride into the next request's history.
- Speaking no longer costs two turns of the daily cap; unknown scenes answer 400 instead of spending a turn; reports are validated against the shipped places; IP counters are day-salted hashes pruned daily; CORS fails closed.
- Each reply says "Kept at your level" when the server had to re-request it.

**Speech**

- The mic is released and the partner's voice silenced when you leave the scene; a late transcript can no longer send a ghost turn.
- Tapping the mic hushes the partner first, so the clip is you, not the phone.
- A cough or a tap no longer becomes "Thank you."; clips are trimmed and downsampled with a proper filter; a stuck "Working out what you said…" times out at 15 s.
- Daily cap and no-connection failures say what happened instead of "Didn't catch that"; browser speech recognition is a real fallback after a 503.
- The chat shows the partner "thinking", scrolls new replies into view, keeps Send reachable, ticks the phrases you used, and offers "Make my Go Card" after six turns.

**Places**

- Team notes, sources and "verify" markers no longer ship in the public data; the one business that never said yes is gone; state offices are listed as public programs; Zoom groups are marked online.
- Picking a place scrolls to its card, flies the map to it and highlights the pin; the list sorts by distance after a ZIP or Near me.
- Offline, the map collapses into a notice and the list, badges and reports keep working from cache.
- "Hard" visits no longer count as positive; duplicates and offline taps get honest messages; the contact address lives in `src/contact.ts`.
- MapLibre 6 (clears a critical advisory); a legend and screen-reader text for status; `?type=` filtering with an invitation when no place of that kind has said yes.

**Shell / PWA**

- About page (purpose, who it is for, how it works, AI disclosure) reachable from the start screen and footer.
- The 1 MB map chunk is no longer downloaded by every visitor (kid mode included); map code, tiles and badges are runtime-cached; a new version shows a "Reload" bar instead of waiting for the second open.
- `<html lang>` is right on every reload and every target-language line carries its language for screen readers; dark theme colour, safe areas, 3:1 control edges, labelled fields.
- Kid mode has a grown-ups exit (change language, clear everything), keyboard-reachable; the cut-out card is in the language of the person reading it.
- Table mode keeps the screen awake, ends without a reload, and announces phase changes instead of every second.

**Content**

- 13 scenes (was 10): parent-teacher conference, a call about a high electric bill, and asking the teacher for help (kid).
- Every phrase on the Go Card is a line you can say; each scene carries the staff's first question; the staff line for Spanish learners finally says "mi español".
- Register fixed (tú for kids, usted to staff), the "No debes" tip that said the opposite, the pharmacy title, gendered lines in the sick-call scene.
- Scripted-mode distractors are plausible learner errors (false cognates, word order, register) with tips that say why, instead of "Where is the milk?".
- The Python validator derives its rules from the schema and runs in CI.

**Content and the loop** (2026-10-09)

- 23 scenes (was 13). New: open a bank account, mail a package, tell the urgent-care nurse what hurts, ask about a job opening, sign a child up for swimming lessons, ask about language classes at the community college; on the phone, make a doctor's appointment and call the school about an absence; for kids, ride the bus and make a friend at the playground.
- Four new place types (bank, post office, bus or train, park district) with labels in both languages and icons; the Places map shows the "no place of this kind has said yes yet" note for them until a row is added.
- The picker groups scenes by what they are for (Health, School and family, Errands around town, Work and money, On the phone) instead of one long "At a counter" list.
- Scenes you finish get a green "Rehearsed" tick on their card, and the end of a scene offers the next one in the same theme that you have not done yet.

**Voice and coaching** (2026-10-05)

- The partner speaks with a neural voice (Aura-2, then MeloTTS once the day's allowance is spent, then the phone's own voice). Verified end to end in Chrome with a recorded sentence as the microphone: transcript, reply, and audio actually playing.
- Android phones get a device voice again (Chrome there reports every system voice as "remote", which the old filter dropped).
- After each spoken turn: closer or farther from the microphone, slower or faster, or "good distance and good pace"; the distance advice also shows live while the mic is open. Quiet clips are boosted before they are sent.
- Navigation: tabs in the order of the loop (Rehearse, Go Card, Places), language and About chips in the header, a three-step strip on the picker, the goal and phrases fold away once the conversation starts, every page opens at its top.
- The same voice reads everything else a learner can tap to hear: the brief's phrases, the scripted scene (and its next line after each choice when replies are read aloud), and every line on the Go Card. Kid mode keeps the phone's own voice, so it stays off the network.
- Under the composer: one row (simpler, another way, the voice switch), and reporting is a link in its own note. The footer no longer repeats the language switch that lives in the header.
- Run `scripts/deploy.ps1` again to put this live; it now writes files without a byte-order mark.

**Design** (2026-10-03)

- A visual identity without a single fetched font: a book-serif voice for titles and lines to say, the two-circle mark, a bottom tab bar on phones, icon scene cards in a grid, numbered phrases that tick off, a one-piece level picker, a mic that is the biggest thing on the page, a Go Card that looks like a card, awnings on the kid storefronts, and a two-column scene page on laptops.

**Docs / tests**

- README, AI-USE.md, submission answers (incl. the new "what did you learn" question), storyboard (names, code shot, tools line) and partner one-pager match the code.
- 139 tests (was 52): Worker routes, caps, fallback parsing, history cleaning, safety in both languages, speech WAV/trim/gate, storage, language model, router, scenes, venue pipeline.
- CI also runs the scene validator, `npm audit`, a Worker dry-run, and the screenshot walk with the API stubbed.
- `npm run walk` works again (start screen, About, offline Places, kid grown-ups panel).

## Needs the user

Only you can do these; none of them is code.

1. **Deploy.** The live site is a September 17 build. From the `charla` folder,
   after `npx wrangler login`:

   ```powershell
   powershell -ExecutionPolicy Bypass -File scripts\deploy.ps1
   ```

   Then open https://charla-naperville.pages.dev on a phone, count 23 scenes,
   tap the microphone, and write the date and commit into the README Status
   paragraph ("deployed YYYY-MM-DD from commit ...").
2. **Fill `src/contact.ts`**: `CONTACT_EMAIL` (shown on Places and the
   partner one-pager) and `REPO_URL` once the repository is public.
3. **Names**: the README Team section and the About page. District is by
   home ZIP+4 for each teammate (IL-06, IL-11 or IL-14), not by the school.
4. **Phone test of one-tap speech** on one iPhone (Safari, and installed to
   the home screen) and one Android (Chrome): tap, talk, pause, the words reach
   the partner, the reply is read aloud. Note what the meter did.
5. **Partner outreach** with `docs/partners.md`: at least one pharmacy and one
   taquería in Aurora. Keep the signed sheets. Add rows, `npm run venues`,
   redeploy.
6. **Register every teammate** in the portal and confirm each district by
   ZIP+4 before the team freeze.
7. **Film the video** per the storyboard in `docs/submission.md` (names on
   camera, one code shot, tools and languages said aloud, 1 to 3 minutes,
   public on YouTube or Vimeo).
8. **The voice budget.** `DAILY_TTS_PREMIUM = "40"` in `worker/wrangler.toml`
   is how many replies a day the natural (Aura-2) voice reads before the
   cheap one takes over, so the free tier's neurons last. On a paid Workers
   plan raise it; and try `TTS_SPEAKER_ES = "estrella"` (or another Aura
   Mexican voice) by ear before judging day.
9. **ANTHROPIC_API_KEY**, only if you want Claude behind the partner:
   `npx wrangler secret put ANTHROPIC_API_KEY --config worker/wrangler.toml`
   after setting a spend limit. Not required; the live partner is gpt-oss-120b.

## Schedule

| Date | What |
|------|------|
| Thu Oct 2 | Audit pass merged; deploy; phone test |
| by Sun Oct 11 | Partner visits done; rows in the CSV; video filmed |
| by Thu Oct 15 | Video edited and public; written answers trimmed to the portal's limits |
| **Sun Oct 18** | **Team freeze**: everyone registered, districts confirmed |
| Fri Oct 23 | Submit (names, answers, AI disclosure, video link, app link) |
| **Mon Oct 26, 12:00 pm ET** | **Portal closes** |

## How to verify

Run from the `charla` folder (`export PATH="$LOCALAPPDATA/nodejs:$PATH"` in
Git Bash if `node` is not on the path).

```bash
npm test                                   # all suites; the last line is the count for the README
npm run typecheck                          # app and Worker
npm run build                              # production bundle in dist/
python scripts/check_scenes.py             # every scene card, without Node
python scripts/build_venues.py             # prints the place count and anything skipped
npm run dev                                # then, in a second terminal:
WALK_BASE=http://localhost:5173 npm run walk   # screenshots into .walk/, report.json, exit 1 on any failure
```

The walk's `report.json` lists every section as `ok` or `FAILED: reason`,
the console errors, failed requests, and every request kid mode made (which
must be none to `/api/` or a tile server). CI runs the same walk against a
production preview with the API stubbed to 503 and uploads the pictures as an
artifact.
