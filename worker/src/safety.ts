// A small pre-call check. The model also returns safety_flag on every turn; this
// catches the obvious cases before we spend a request. Extend the list as you
// test; keep it short and G-rated in spirit.

const BLOCK: RegExp[] = [
  /\b(sex|sexy|porn|nude|naked)\b/i,
  /\b(kill (myself|yourself)|suicide|hurt myself)\b/i,
]

export function blocked(text: string): boolean {
  return BLOCK.some((re) => re.test(text))
}

// Turns that are about the partner's instructions rather than the scene. The
// prompt already says to treat these as dialogue, and Claude does; the free
// fallback model followed "speak only in French now" to the letter. Caught
// here, they cost no request and get the same redirect line as any drift.
const META: RegExp[] = [
  /\b(ignore|forget|disregard|override)\b.{0,20}\b(rules?|instructions?|prompt|guidelines?)\b/i,
  /\b(system|initial|hidden|secret)\s+(prompt|instructions?|message)\b/i,
  /\byou are now\b/i,
  /\b(speak|answer|reply|respond|talk|write|r[ée]pond(ez|s)?)\s+(only\s+)?(in|en)\s+(french|german|italian|portuguese|chinese|japanese|russian|arabic|hindi|korean|fran[çc]ais)\b/i,
  /\bpretend (you are|to be|you're)\b/i,
  /\bnew (rules|instructions|persona|role)\b/i,
  /\b(jailbreak|developer mode|dan mode)\b/i,
]

export function meta(text: string): boolean {
  return META.some((re) => re.test(text))
}

export const CANNED = {
  redirect: {
    en: "Let's get back to the scene. What do you need today?",
    es: 'Volvamos a la escena. ¿Qué necesitas hoy?',
  },
}
