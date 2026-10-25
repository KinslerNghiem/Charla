// A line nobody could answer. Four shapes a real learner line never has: the
// same word three times running ("money, money, money"), numbers standing in
// for words ("Medicine 4 Upkick My 4 Mother 4"), a long "word" with no vowel,
// or symbols and digits outnumbering the letters. Caught on the Worker before
// any model call, so the partner says it did not catch that and asks again,
// and nothing in the errand moves. Nonsense made of real words ("purple cats
// sing tuesday") is the model's call, through the "understood" field.
//
// Real lines pass: a date of birth has numbers, "¡Gracias!" is one word,
// "10:30?" is an answer, a code-switched sentence is still words.

function fold(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '')
}

export function looksGarbled(text: string): boolean {
  const toks = text.toLowerCase().split(/[^\p{L}\p{N}'-]+/u).filter(Boolean)
  if (toks.length === 0) return false
  for (let i = 2; i < toks.length; i++) if (toks[i] === toks[i - 1] && toks[i] === toks[i - 2]) return true
  const nums = toks.filter((t) => /^\d+$/.test(t))
  const single = nums.filter((t) => t.length === 1).length
  if (single >= 3 || (toks.length >= 4 && nums.length * 2 > toks.length)) return true
  if (toks.some((t) => /^\p{L}{6,}$/u.test(t) && !/[aeiouy]/.test(fold(t)))) return true
  const letters = (text.match(/\p{L}/gu) ?? []).length
  const other = (text.match(/[\p{N}\p{S}\p{P}]/gu) ?? []).length
  return toks.length >= 3 && letters < other
}
