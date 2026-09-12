import { useState } from 'preact/hooks'
import { t } from '../i18n/lang'
import { modeFor, validBirth, type Mode } from './gate'

// Neutral by design (this is what the FTC's COPPA guidance asks for):
// month and year only, no default value, no "13+" hint before the question,
// nothing that encourages a child to lie.

export function BirthGate({ onDone }: { onDone: (mode: Mode) => void }) {
  const [month, setMonth] = useState('')
  const [year, setYear] = useState('')
  const m = Number(month)
  const y = Number(year)
  const ok = month !== '' && year.length === 4 && validBirth(m, y)

  return (
    <main class="gate">
      <h1>{t('app_name')}</h1>
      <p class="tagline">{t('tagline')}</p>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (ok) onDone(modeFor(m, y))
        }}
      >
        <h2>{t('gate_title')}</h2>
        <label>
          {t('gate_month')}
          <select value={month} onChange={(e) => setMonth((e.target as HTMLSelectElement).value)} required>
            <option value="" disabled>
              —
            </option>
            {Array.from({ length: 12 }, (_, i) => (
              <option value={String(i + 1)}>{String(i + 1).padStart(2, '0')}</option>
            ))}
          </select>
        </label>
        <label>
          {t('gate_year')}
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]{4}"
            maxLength={4}
            value={year}
            onInput={(e) => setYear((e.target as HTMLInputElement).value.replace(/\D/g, ''))}
            required
          />
        </label>
        <button type="submit" class="primary" disabled={!ok}>
          {t('gate_continue')}
        </button>
        <p class="note">{t('gate_why')}</p>
      </form>
    </main>
  )
}
