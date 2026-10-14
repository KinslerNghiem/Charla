// Lets a plain Node script import the app's TypeScript the way Vite does:
//   node --experimental-strip-types --import ./scripts/ts-resolve.mjs scripts/convo-bench.mjs
// Node strips the types itself, but it insists on file extensions; the app's
// imports have none ("./text", "../skills/intents"). This hook tries ".ts"
// when a relative import has no extension and nothing else resolves.
import { register } from 'node:module'

register('./ts-hooks.mjs', import.meta.url)
