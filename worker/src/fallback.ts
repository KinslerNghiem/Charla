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
