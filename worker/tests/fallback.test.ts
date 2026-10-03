import { describe, expect, it, vi } from 'vitest'
import { fallbackJson, type ChatMsg } from '../src/fallback'
import { TurnSchema } from '../../src/tutor/turn'

// Workers AI answers in three shapes depending on the model, and sometimes in a
// code fence. fallbackJson turns all of them into one parsed Turn or one of two
// failures: parsed:null (the model answered badly) or error:true (it did not
// answer). The caller treats those two differently, so they must stay distinct.

const good = { reply: 'Of course. What is her name?', tip: '', alt: [], on_topic: true, goal_reached: false, safety_flag: false }
const msgs: ChatMsg[] = [{ role: 'system', content: 's' }, { role: 'user', content: 'u' }]

function ai(result: unknown, reject = false) {
  const run = reject ? vi.fn().mockRejectedValue(new Error('quota')) : vi.fn().mockResolvedValue(result)
  return { ai: { run } as unknown as Ai, run }
}

describe('fallbackJson', () => {
  it('reads the native {response} shape', async () => {
    const { ai: a } = ai({ response: good, usage: { prompt_tokens: 10, completion_tokens: 5 } })
    const res = await fallbackJson(a, '@cf/meta/llama-3.3-70b-instruct-fp8-fast', msgs, TurnSchema, 500)
    expect(res.parsed).toEqual(good)
    expect(res.error).toBe(false)
    expect(res.usage).toEqual({ in: 10, out: 5 })
  })

  it('reads the chat-completions shape and strips a code fence', async () => {
    const { ai: a, run } = ai({ choices: [{ message: { content: '```json\n' + JSON.stringify(good) + '\n```' } }] })
    const res = await fallbackJson(a, '@cf/openai/gpt-oss-120b', msgs, TurnSchema, 500)
    expect(res.parsed).toEqual(good)
    expect(res.raw).toContain('```json')
    const input = run.mock.calls[0][1] as { response_format: { json_schema: { name: string } }; messages: ChatMsg[] }
    expect(input.messages).toEqual(msgs)
    expect(input.response_format.json_schema.name).toBe('turn')
  })

  it('returns parsed:null, not an error, when the text is not JSON', async () => {
    const { ai: a } = ai({ output_text: 'not json' })
    const res = await fallbackJson(a, '@cf/openai/gpt-oss-120b', msgs, TurnSchema, 500)
    expect(res.parsed).toBeNull()
    expect(res.error).toBe(false)
    expect(res.raw).toBe('not json')
  })

  it('returns parsed:null when the JSON does not fit the schema', async () => {
    const { ai: a } = ai({ response: { reply: 5, tip: '' } })
    const res = await fallbackJson(a, '@cf/openai/gpt-oss-120b', msgs, TurnSchema, 500)
    expect(res.parsed).toBeNull()
    expect(res.error).toBe(false)
  })

  it('returns error:true when the binding throws, and never throws itself', async () => {
    const { ai: a } = ai(null, true)
    const res = await fallbackJson(a, '@cf/openai/gpt-oss-120b', msgs, TurnSchema, 500)
    expect(res).toEqual({ parsed: null, raw: '', usage: { in: 0, out: 0 }, error: true })
  })
})
