# Submission drafts

The portal closes **Monday, October 26, 2026, 12:00 pm ET**. Team freeze
(every member registered, districts confirmed) is **October 18**. Plan: submit
Friday October 23. These are drafts of the written answers; check the exact
question wording in the portal and trim to its character limits (the 2026
form says the questions are "similar to" these; an older form capped purpose
at 140, inspiration at 200 and difficulty at 1,500 characters, and the new
limits are unconfirmed). Everything in here is true of the app as of the date
at the bottom.

**Re-check before pasting:** the scene count (`ls src/content/scenes/*.json`),
the place count (`npm run venues` prints it), the test count (`npm test`), and
that the live site was deployed from the commit you are submitting.

Facts to keep straight:

- 20,546 people in Aurora and 1,435 in Naperville speak Spanish at home and
  speak English less than "very well" (ACS 2020–24, table C16001). DuPage
  County: 37,024. Will County: 32,738.
- Naperville sits in three congressional districts (IL-06, IL-11, IL-14). The
  team's district is decided by home address (ZIP+4), not by the school.
- Judging (Rules §7): quality of the idea; implementation (user experience,
  design); demonstrated excellence of coding. The sample rubric also scores
  whether the video explains the code.

---

## Title

Charla

## Purpose (one sentence)

Charla helps Spanish speakers in Naperville and Aurora rehearse one real
conversation at their level, then go have it at a real place nearby that said
it would be patient.

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
partner that stays at your level, get a card with your phrases, and open a map
of real places nearby that told us they would be patient with you. Then go.
After the visit, one tap makes the map better for the next person.

We also wanted the app to be honest about kids. Our younger siblings would use
this, and an app for a nine-year-old should not phone home. So the under-13
mode sends nothing anywhere, and we built it so that is enforced by the code,
not by a promise.

## 2. What does your app do?

Charla is a conversation-practice app for Spanish speakers learning English
(and English speakers learning Spanish) in Naperville and Aurora, Illinois.

- **Rehearse.** Thirteen scenes, each one a conversation you will actually
  have: a pharmacy refill, a clinic front desk, the driver-services window,
  the school office, a parent-teacher conference, asking for help in class, a
  taquería order, a library card, a deli counter, an ice cream shop, and three
  phone calls (a landlord repair, calling in sick, a question about the
  electric bill). An AI partner plays the person on the other side and stays
  at your level: three bands, every reply measured on the server against the
  band, one rewrite requested if it drifts, and the app tells you when that
  happened. Corrections come inside the reply; a "Simpler" button drops a
  level. Typing always works. Speaking is one tap: tap, talk, pause, and your
  words go to the partner, whose reply comes back read aloud.
- **Go Card.** Your phrases, the first question the staff will ask you, the
  reply to expect, and one line to show the staff. It opens in airplane mode.
- **Places.** A map of places where staff will meet you halfway. Today that is
  the public programs we verified (libraries, conversation groups, the
  community college, the driver-services office); businesses appear as their
  owners sign our one-page agreement. Each place carries a per-language badge
  earned from visitors' anonymous one-tap reports. Places, never people: no
  user coordinates are stored, and the report id is salted per place so one
  visitor's taps cannot be joined into a trail.
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
code enforces it, and the app shows "Kept at your level" when it had to.

**A free model that needed more guardrails than a paid one.** The partner runs
on an open-weight model on Cloudflare's free tier so the app costs nothing to
keep up. That model sometimes answered in the wrong language, sometimes spoke
the learner's own line back, sometimes returned a fragment or a stage
direction instead of a sentence, and could be talked out of its role by
"ignore your rules". Each of those became a check in code rather than a line
in the prompt: a reply-language test, a whose-line test against the learner's
phrases, a fragment-and-narration guard, and a meta-instruction filter that
runs over the whole history. If the model cannot be reached at all the server
says so (a 503) and the app drops into the scripted version of the same scene
with a retry, instead of pretending with a canned reply.

**Speech on a phone.** Our first voice path trusted the phone's own recorder.
On an iPhone that produces an AAC clip inside an MP4, and the transcription
model on the server rejected it on the live site. The fix was to stop trusting
the recorder: the app now captures raw samples through the Web Audio API,
resamples them to 16 kHz mono and writes a WAV file itself, byte for byte the
same on every browser. The same samples drive the level meter, decide when the
learner has paused, and throw away clips too short to be speech. The browser's
built-in recognition is kept only as a fallback, and typing always works.

**Making "kid mode collects nothing" true rather than promised.** The
networked half of the app (map, API client, the pages that use them) lives
behind a dynamic import that only runs for teen and adult modes. A test walks
the import graph from the app shell and fails if kid mode can reach any of it.
We then confirmed it in a real browser by watching every request kid mode
makes: only the app shell and its own module load, and the screenshot walk
fails on any request to the API or a tile server.

**Reports that help the map without tracking the reporter.** Each "I went"
carries a hash of (device id + place id), so the same phone gets a different
hash at every place and the rows cannot be joined into an itinerary. The daily
caps count devices and IP addresses only as hashes salted with the day, and
yesterday's rows are pruned, so there is nothing to subpoena. The public
endpoint returns only counts in 30-day buckets. Duplicate taps are rejected by
a database unique index rather than by logic that could drift.

## 4. What did you learn? What was your biggest takeaway?

Compile early. We wrote much of the app before Node was installed, confident
that careful reading would catch what a compiler catches. The first real
compile found a file named `Gate.tsx` beside `gate.ts`, which Windows treats
as the same file, and a test whose "acceptable" sentence broke the very band
it was testing. Neither was hard to fix; both would have been found in a
minute by running the tools. The bigger version of that lesson: a prompt is
not a guarantee. We told the model to stay at the learner's level, to answer
in English, to never speak the learner's line, and it did most of the time.
"Most of the time" is not a product, so every rule we cared about became a
check in code with a test, and the prompt became a suggestion the code
verifies.

Translating is not localizing. Our card had a line to show the staff: "I'm
practicing my English, please speak slowly." Translated into Spanish it said
"my English", which made no sense to the Spanish speaker it was meant for;
the line for an English speaker practicing Spanish has to say "mi español".
We found a dozen smaller versions of the same thing once we started reading
the Spanish side as a Spanish speaker rather than as a translation, and it
changed how we review content: every string is read in the situation it will
be used in, not next to its English twin.

## 5. What improvements would you make in a 2.0 version?

- Speech recognized on the device, so a clip never has to leave the phone at
  all and speaking works with no signal, the way the Go Card already does.
- More scenes, chosen with the people who use them rather than by us: we want
  to sit with learners at the library conversation groups and write the next
  ten from what they say they dread.
- A "verified by a visit" badge earned when someone on the team has been to the
  place, alongside the crowd badge.
- Other language pairs. The scene cards are language-neutral JSON, so a
  Polish–English or Arabic–English edition is content work, not code.
- Real tandem matching, but only the way the plan says: adults, a public place,
  the app mediating the first meeting, and nothing stored about who met whom.

## 6. What programming languages and tools did you use?

**Languages:** TypeScript (app and server), Python (content validators and the
venue pipeline), SQL (the reports database), HTML and CSS.

**Tools:** Vite and Preact for the app; vite-plugin-pwa for the installable
build; MapLibre GL with OpenFreeMap tiles for the map; Cloudflare Workers and
D1 for the API; Cloudflare Workers AI for the practice partner (the
open-weight gpt-oss-120b model) and for speech-to-text (Whisper), with the
Anthropic API (Claude) as a drop-in when a key is configured; Vitest and
Playwright for tests and screenshots; addresses geocoded once by hand with the
Census Bureau geocoder website and pasted into the spreadsheet; Git and GitHub
with a CI workflow that runs every check and a full screenshot walk on every
push.

## 7. How did you use AI?

Two ways, both disclosed in `AI-USE.md` in the repository.

**Inside the app:** a language model plays the person behind the counter in
Rehearse and answers the help box in Table mode, and a speech model turns the
learner's voice into text, which is discarded after transcription. At
submission the partner runs on gpt-oss-120b on Cloudflare Workers AI; the
same code runs on Claude when an API key is present. Everything around the
model is ours: the scene format, the level bands and the retry, the
reply-language, whose-line and fragment checks, the safety filters, the daily
caps, the scripted fallback, and the kid mode, which uses no AI at all.

**Building the app:** we used Claude Code as a coding assistant. The log in
`AI-USE.md` records each session and what it produced. We reviewed every file,
and we can explain every file; the judges are welcome to ask.

---

## Video (1 to 3 minutes, public link)

Required on screen or in voice: each participant's name, the app's name, its
purpose in one sentence, the target audience, the tools and languages, and the
app working. The rubric also scores whether the video explains the code, so
there is one code shot. Shoot vertical on a phone, in the light, outside a
real place on the map. No music over voice. Film the "Simpler" shot with the
level set to B1 so the drop to A2 is visible.

| Time | Shot | Line |
|------|------|------|
| 0:00 | Team outside a pharmacy; lower-third with each name | "We're ___, ___ and ___ from Naperville. Every language app teaches you words. None of them gets you through this door." |
| 0:10 | Same shot, straight to camera | "Charla is for Spanish speakers in Naperville and Aurora who are learning English. It rehearses one real conversation at your level, then sends you to a real place nearby." |
| 0:22 | Screen: picker → pharmacy scene, one tap, speak, the reply read aloud | "You tap once and talk. The partner answers at your level and corrects you inside the reply." |
| 0:40 | Screen: level set to Intermedio (B1), tap Simpler, the reply shrinks to Básico (A2) | "Too much? One tap makes it simpler. The server checks every reply against the level." |
| 0:50 | Code: `src/tutor/levels.ts` `checkReply`, then the retry in `worker/src/tutor.ts` | "This is the check. Words per sentence, sentences, questions. If the model drifts, this line asks it once more, naming the rule it broke." |
| 1:03 | Screen: Go Card in airplane mode | "Your phrases, the first question they'll ask you, and one line to show the staff. Works with no signal." |
| 1:15 | Screen: map, tap a place, the badge | "Real places nearby that said they'd be patient. Places, never people." |
| 1:30 | Real counter, the staff line shown on the phone | (the conversation, subtitled) |
| 1:48 | Screen: "I went" tap, the thank-you | "One tap, anonymous, and the map gets better for the next person." |
| 1:58 | Screen: Table mode, timer running, one prompt | "Two people, one phone, ten minutes, half in each language." |
| 2:05 | Kid with the phone, Charlita | "For kids under 13 there's Charlita. It sends nothing. We built it so it can't, and a test proves it." |
| 2:20 | Team, one line each on what they built | "TypeScript, Preact, Cloudflare Workers, D1, Python. One of us wrote the level checker, one the map and reports, one the scenes and the Spanish." |
| 2:40 | Title card: Charla, the team's names, GitHub link, "Built in Naperville for the 2026 Congressional App Challenge" | |

## Checklist before submitting

- [ ] Every team member registered in the portal, district confirmed by ZIP+4
- [ ] Deployed build matches `main`: open the link, count 23 scenes, tap the microphone
- [ ] About page shows the team's names
- [ ] Contact email filled in `src/contact.ts` and showing on the Places tab
- [ ] Video public (YouTube or Vimeo), 1 to 3 minutes, names and tools said on camera, no copyrighted music
- [ ] Written answers pasted, within limits
- [ ] `AI-USE.md` up to date and pasted into the AI disclosure field
- [ ] Repository public (and `REPO_URL` set in `src/contact.ts`) or a zip ready if the judges ask for code
- [ ] App link in the form opens on a phone
- [ ] Places on the map: every business row has a signed one-pager on file

Drafted 2026-09-11. Revised 2026-10-02.
