// A small pre-call check. The model also returns safety_flag on every turn; this
// catches the obvious cases before we spend a request. Extend the list as you
// test; keep it short and G-rated in spirit.
//
// Spanish patterns use (?<!\p{L}) and (?!\p{L}) instead of \b: JavaScript's \b
// only knows ASCII word characters, so "\bmorir\b" fails next to an accented
// letter and "\bsexo\b" would match inside "sexólogo".

const BLOCK: RegExp[] = [
  // "sex" on its own, not "sex education" or "sex ed" (a class someone takes).
  /\b(sex(?!\s+(education|ed)\b)|sexy|porn\w*|nude|naked)\b/i,
  /\b(kill (myself|yourself)|suicide|suicidal|hurt myself|want to die|end my life)\b/i,
  /(?<!\p{L})(matarme|suicid\p{L}*|quiero morir(me)?|me quiero morir|hacerme da[ñn]o|lastimarme|quitarme la vida)(?!\p{L})/iu,
  /(?<!\p{L})(sexo|(?<!educaci[óo]n\s)sexual|porno\p{L}*|desnud\p{L}*)(?!\p{L})/iu,
]

export function blocked(text: string): boolean {
  return BLOCK.some((re) => re.test(text))
}

// Turns that are about the partner's instructions rather than the scene. The
// prompt already says to treat these as dialogue, and Claude does; the free
// fallback model followed "speak only in French now" to the letter. Caught
// here, they cost no request and get the same redirect line as any drift.
//
// Each rule wants the instruction aimed at the partner. "Forget the
// instructions for the medicine" and "my boss gave me new instructions" are
// scene dialogue, and a learner saying them must not be met with the redirect.
const META: RegExp[] = [
  /\b(ignore|forget|disregard|override)\b.{0,12}\b(your|all|previous|above|earlier|these)\s+(rules|instructions|prompt|guidelines)\b(?!\s+for\b)/i,
  /\b(system|initial|hidden|secret)\s+(prompt|instructions?)\b/i,
  /\byou are now (a|an|the|my)\s/i,
  /\b(speak|answer|reply|respond|talk|write|r[ée]pond(ez|s)?)\s+(only\s+)?(in|en)\s+(french|german|italian|portuguese|chinese|japanese|russian|arabic|hindi|korean|fran[çc]ais)\b/i,
  /\bpretend (you are|to be|you're)\b/i,
  /\b(your|here are)\s+new\s+(rules|instructions|persona)\b/i,
  /\b(jailbreak|developer mode|dan mode)\b/i,
  // The same moves in Spanish.
  /(?<!\p{L})(ignora|ignorá|ignore|olvida|olvidá|olvide)(?!\p{L}).{0,12}(?<!\p{L})(tus|las|todas las)\s+(reglas|instrucciones)(?!\p{L})/iu,
  /(?<!\p{L})(habla|hable|responde|responda|contesta|conteste|escribe|escriba)\s+(solo\s+|sólo\s+)?en\s+(francés|frances|alemán|aleman|italiano|portugués|portugues|chino|japonés|japones|ruso|árabe|arabe)(?!\p{L})/iu,
  /(?<!\p{L})ahora eres(?!\p{L})/iu,
  /(?<!\p{L})finge que eres(?!\p{L})/iu,
  /(?<!\p{L})nuevas (reglas|instrucciones)(?!\p{L})/iu,
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
