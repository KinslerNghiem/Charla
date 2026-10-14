// The Anthropic SDK's zodOutputFormat helper is typed and implemented against
// zod v4, so import v4 explicitly. A bare 'zod' import resolves to v3 under
// "zod": "^3.25" and both fails to typecheck and throws at the first request.
import { z } from 'zod/v4'

// The shape of one partner turn. The Worker asks the model for exactly this
// (structured output), so the app never parses free text.
export const TurnSchema = z.object({
  reply: z.string().describe("The partner's next line, in character, in the target language."),
  tip: z.string().describe('One short correction in the learner\'s native language, or "" if nothing blocked meaning.'),
  alt: z.array(z.string()).describe('Zero to two alternative ways to say what the learner tried to say, in the target language.'),
  on_topic: z.boolean().describe('False if the learner drifted away from the scene.'),
  goal_reached: z.boolean().describe('True once the scene\'s success condition has been met.'),
  safety_flag: z.boolean().describe('True if the learner wrote something unsafe, adult, or about self-harm.'),
  // The three fields the conversation flow uses (src/tutor/flow.ts). The
  // Worker bounds them before the app sees them: the step index inside the
  // scene, the gloss and the suggestion each in the language it belongs in.
  step: z.number().describe("1, 2 or 3: which of the learner's phrases their latest turn accomplished, in their own words or close to them; 0 if none."),
  gloss: z.string().describe("Your reply translated into the learner's own language, one line. Shown only if they ask for a translation."),
  suggest: z.string().describe('One natural sentence in the target language the learner could say next to move the errand forward. Never your own line.'),
  // The model's one vote on the communication skill the learner's turn used.
  // The app's own rule-based classifier (src/skills/intents.ts) decides first;
  // the Worker keeps this only when it names one of the eight skill ids.
  skill: z.string().describe("The communication skill the learner's latest turn used, if clearly any: repeat, slow_down, clarify, confirm, follow_up, problem, unknown_word or next_step. \"\" if none."),
})

export type Turn = z.infer<typeof TurnSchema>

// What /api/turn actually returns: the model's Turn plus one field the Worker
// adds itself. kept_at_level is true when the drift guard re-requested the
// reply, so the app can show a small "Kept at your level" tag. It is not part
// of TurnSchema on purpose: the model never sees or sets it.
export type TurnResponse = Turn & { kept_at_level?: boolean }

export const HelpSchema = z.object({
  phrase: z.string().describe('How to say it in the target language.'),
  literal: z.string().describe('A literal gloss in the native language.'),
  tip: z.string().describe('One short pronunciation or usage tip, or "".'),
})

export type Help = z.infer<typeof HelpSchema>
