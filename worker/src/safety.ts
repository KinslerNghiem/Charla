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

export const CANNED = {
  redirect: {
    en: "Let's get back to the scene. What do you need today?",
    es: 'Volvamos a la escena. ¿Qué necesitas hoy?',
  },
}
