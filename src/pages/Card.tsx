import { sceneById } from '../content/scenes'
import { learning, native, t } from '../i18n/lang'
import { get } from '../storage'
import { speak } from '../speech/output'

interface LastCard {
  scene_id: string
  place: string | null
  level: string
  ts: number
}

// The Go Card is what you take to the counter. It is built from the scene, not
// from the API, so it opens in airplane mode.
export function Card() {
  const card = get<LastCard | null>('lastCard', null)
  const scene = sceneById(card?.scene_id)
  const target = learning()
  const nat = native()
  if (!card || !scene) return <p class="empty">{t('card_empty')}</p>
  return (
    <section class="card">
      <h1>{t('card_title')}</h1>
      <p class="scene-name">
        {scene.title[target]}
        {card.place ? ` · ${card.place}` : ''}
      </p>
      <h2>{t('phrases')}</h2>
      <ul class="phrases">
        {scene.must_use.map((p) => (
          <li>
            <button type="button" class="ghost small" onClick={() => speak(p[target], target)} aria-label={t('listen')}>
              🔊
            </button>
            <b>{p[target]}</b> <i>{p[nat]}</i>
          </li>
        ))}
      </ul>
      <h2>{t('expected')}</h2>
      <p>{scene.success[target]}</p>
      <p class="gloss">{scene.success[nat]}</p>
      <h2>{t('staff_line')}</h2>
      <p class="staff-line">{scene.show_staff_line[target]}</p>
      <p>
        <a class="primary" href="#/places">
          {t('where_real')}
        </a>
      </p>
    </section>
  )
}
