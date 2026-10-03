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
  // `expect` is the staff's first real question. A scene without one shows
  // only how the visit ends.
  const expect = scene.expect
  return (
    <section class="card">
      <h1>{t('card_title')}</h1>
      <p class="scene-name" lang={target}>
        {scene.title[target]}
        {card.place ? ` · ${card.place}` : ''}
      </p>
      <h2>{t('phrases')}</h2>
      <ul class="phrases">
        {scene.must_use.map((p) => (
          <li>
            <button type="button" class="ghost listen" onClick={() => speak(p[target], target)}>
              🔊 {t('listen')}
            </button>
            <span>
              <b lang={target}>{p[target]}</b> <i>{p[nat]}</i>
            </span>
          </li>
        ))}
      </ul>
      <h2>{t('expected')}</h2>
      {expect ? (
        <>
          <p lang={target}>{expect[target]}</p>
          <p class="gloss">{expect[nat]}</p>
          <h2>{t('card_how_it_ends')}</h2>
          <p lang={target}>{scene.success[target]}</p>
          <p class="gloss">{scene.success[nat]}</p>
        </>
      ) : (
        <>
          <p lang={target}>{scene.success[target]}</p>
          <p class="gloss">{scene.success[nat]}</p>
        </>
      )}
      <h2>{t('staff_line')}</h2>
      <p class="staff-line" lang={target}>
        {scene.show_staff_line[target]}
      </p>
      <p>
        <a class="primary" href={`#/places?type=${encodeURIComponent(scene.place_type)}`}>
          {t('where_real')}
        </a>
      </p>
    </section>
  )
}
