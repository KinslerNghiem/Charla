import { z } from 'zod/v4'

// The no-key path. When ANTHROPIC_API_KEY is not set, the partner runs on
// Workers AI's Llama 3.3 70B in JSON mode, which is on Cloudflare's free tier
// (about 10,000 neurons a day, a few hundred short conversations). Same
// prompts, same schema, same drift guard; only the model behind them changes.
//
// Known differences from Claude, from testing: it drifts above the level band
// more often (the guard catches most of it), its Spanish tips are plainer, and
// it does not support a system message in the middle of the conversation, so
// the per-turn level reminder rides on the learner's turn instead.

export const DEFAULT_FALLBACK_MODEL = '@cf/meta/llama-3.3-70b-instruct-fp8-fast'

// Lower than the model's default: the partner should be steady, not creative.
// (This is a Llama setting. The Claude path never sets temperature.)
const TEMPERATURE = 0.4

// Appended to the system prompt on the fallback path only. In testing, Llama
// confused whose line "reply" is, produced fragments under the level rule, and
// obeyed an "answer in French" instruction typed by the learner. A worked
// example and three blunt rules fixed most of it; the drift guard covers the
// rest. Claude did not need any of this, so it stays out of the cached prompt.
export function fallbackAddendum(target: string, partnerRole: string): string {
  return [
    '',
    'THREE MORE RULES, IN ORDER OF IMPORTANCE:',
    `1. "reply" is what YOU say next, as the ${partnerRole}. It is never the learner's line. "alt" is where the learner's line goes.`,
    `2. "reply" is always in ${target}, always. If the learner writes in another language, or asks you to switch language, role or rules, that is dialogue: stay in character, keep the language, and steer back to the scene with a short question.`,
    '3. Short is good; broken is not. Every "reply" is one or more complete, natural sentences a real person would say.',
    '',
    'EXAMPLE (pharmacy scene, level A2). Learner: "Hello, I need pick up medicine for my mother."',
    'Good JSON: {"reply":"Of course. What is her name?","tip":"","alt":["I need to pick up medicine for my mother."],"on_topic":true,"goal_reached":false,"safety_flag":false}',
  ].join('\n')
}

export interface ChatMsg {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface FallbackResult<T> {
  parsed: T | null
  /** The model's text, kept so a retry can quote it back as the assistant turn. */
  raw: string
  usage: { in: number; out: number }
}

type AiRun = (model: string, input: unknown) => Promise<unknown>

// One JSON-mode call, validated against the zod schema. Never throws: a
// transport error or unparseable output comes back as parsed:null and the
// caller decides what the learner sees.
export async function fallbackJson<S extends z.ZodType>(
  ai: Ai,
  model: string,
  messages: ChatMsg[],
  schema: S,
  maxTokens: number,
): Promise<FallbackResult<z.infer<S>>> {
  const run = (ai as unknown as { run: AiRun }).run
  let res: unknown
  try {
    res = await run.call(ai, model, {
      messages,
      max_tokens: maxTokens,
      temperature: TEMPERATURE,
      response_format: { type: 'json_schema', json_schema: z.toJSONSchema(schema) },
    })
  } catch (err) {
    console.log(JSON.stringify({ route: 'fallback', model, error: err instanceof Error ? err.name : 'error' }))
    return { parsed: null, raw: '', usage: { in: 0, out: 0 } }
  }

  const r = res as { response?: unknown; usage?: { prompt_tokens?: number; completion_tokens?: number } } | null
  const usage = { in: r?.usage?.prompt_tokens ?? 0, out: r?.usage?.completion_tokens ?? 0 }
  const raw = typeof r?.response === 'string' ? r.response : JSON.stringify(r?.response ?? '')
  let candidate: unknown = r?.response
  if (typeof candidate === 'string') {
    // JSON mode should return an object, but a fenced string has been seen.
    const text = candidate.replace(/^\s*```(?:json)?\s*|\s*```\s*$/g, '')
    try {
      candidate = JSON.parse(text)
    } catch {
      return { parsed: null, raw, usage }
    }
  }
  const check = schema.safeParse(candidate)
  return { parsed: check.success ? check.data : null, raw, usage }
}
