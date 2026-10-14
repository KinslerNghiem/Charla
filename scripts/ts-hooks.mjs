// The resolve hook behind scripts/ts-resolve.mjs. Relative imports without an
// extension get ".ts" appended when the bare path does not exist; everything
// else goes to Node's own resolver untouched.
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

export async function resolve(specifier, context, next) {
  if (specifier.startsWith('.') && !/\.[a-z]+$/i.test(specifier) && context.parentURL) {
    const base = new URL(specifier, context.parentURL)
    if (!existsSync(fileURLToPath(base)) && existsSync(fileURLToPath(base) + '.ts')) return next(specifier + '.ts', context)
  }
  return next(specifier, context)
}
