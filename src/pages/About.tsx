import { lang, t } from '../i18n/lang'
import { REPO_URL } from '../contact'

// One screen a judge can read in a minute: what Charla is for, who it is for
// (with the Census numbers that started it), how the three unusual parts work,
// and the AI disclosure the App Challenge asks for. No decoration: one h1,
// a few h2s, plain text. Network-free, so it can also be opened from the
// first screen, before the gate.

// ACS 2020-24 five-year estimates, table C16001: people 5+ who speak Spanish at
// home and speak English less than "very well".
const NUMBERS: [string | null, number][] = [
  ['Aurora', 20546],
  ['Naperville', 1435],
  [null, 37024], // DuPage County: named through the strings below
  [null, 32738], // Will County
]

export function About() {
  const ui = lang()
  const fmt = (n: number) => n.toLocaleString(ui === 'es' ? 'es-US' : 'en-US')
  const names = [NUMBERS[0][0], NUMBERS[1][0], t('about_dupage'), t('about_will')]
  return (
    <section class="about">
      <h1>{t('about_title')}</h1>
      <p class="lede">{t('about_purpose')}</p>

      <h2>{t('about_numbers_h')}</h2>
      <p>{t('about_numbers_intro')}</p>
      <table class="numbers">
        <tbody>
          {NUMBERS.map(([, n], i) => (
            <tr>
              <th scope="row">{names[i]}</th>
              <td>{fmt(n)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p class="note">{t('about_source')}</p>

      <h2>{t('about_how_h')}</h2>
      <ul>
        <li>{t('about_how_level')}</li>
        <li>{t('about_how_hash')}</li>
        <li>{t('about_how_kids')}</li>
      </ul>

      <h2>{t('about_ai_h')}</h2>
      <p>{t('about_ai')}</p>

      <p class="team">
        {t('about_team')}
        {REPO_URL && (
          <>
            {' '}
            <a href={REPO_URL} rel="noopener">
              {t('about_code')}
            </a>
          </>
        )}
      </p>
    </section>
  )
}
