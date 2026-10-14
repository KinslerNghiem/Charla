import { sceneById } from '../content/scenes'
import { learning, native, t } from '../i18n/lang'
import { get } from '../storage'
import { likelyQuestions } from '../tutor/flow'
import { Icon } from '../ui/Icon'
import { ListenButton, useListen } from '../ui/ListenButton'

interface LastCard {
  scene_id: string
  place: string | null
  level: string
  ts: number
}

// The Go Card is what you take to the counter. It is built from the scene, not
// from the API, so it opens in airplane mode, and it is laid out like a card
// so it reads at arm's length while someone waits.
export function Card() {
  const card = get<LastCard | null>('lastCard', null)
  const scene = sceneById(card?.scene_id)
  const target = learning()
  const nat = native()
  const { speaking, toggle } = useListen(target)
  const listenButton = (text: string) => <ListenButton text={text} speaking={speaking} onToggle={toggle} />
  if (!card || !scene) {
    return (
      <section class="card">
        <div class="empty-state">
          <span class="glyph" aria-hidden="true">
            <Icon name="card" size={56} />
          </span>
          <p>{t('card_empty')}</p>
          <a class="primary" href="#/learn">
            {t('nav_learn')}
          </a>
        </div>
      </section>
    )
  }
  // `expect` is the staff's first real question. A scene without one shows
  // only how the visit ends.
  const expect = scene.expect
  // More of what the staff may ask, from the scene's own script.
  const hear = likelyQuestions(scene, target)
  // A call to the landlord or the boss happens at home or at work, which the
  // map cannot list, so those cards open every place rather than an empty filter.
  const placesHref = scene.place_type === 'home' || scene.place_type === 'work' ? '#/places' : `#/places?type=${encodeURIComponent(scene.place_type)}`
  return (
    <section class="card">
      <article class="gocard">
        <header>
          <h1>{t('card_title')}</h1>
          <p class="scene-name" lang={target}>
            {scene.title[target]}
            {card.place ? ` · ${card.place}` : ''}
          </p>
        </header>
        <div class="body">
          <h2>{t('phrases')}</h2>
          <ol class="phrases">
            {scene.must_use.map((p, i) => (
              <li>
                <span class="num" aria-hidden="true">
                  {i + 1}
                </span>
                <span>
                  <b lang={target}>{p[target]}</b>
                  <i lang={nat}>{p[nat]}</i>
                </span>
                {listenButton(p[target])}
              </li>
            ))}
          </ol>
          {scene.example_details && <p class="note examples">{t('card_examples')}</p>}
          {expect ? (
            <>
              <h2>{t('expected')}</h2>
              <p class="expect with-voice">
                <span lang={target}>{expect[target]}</span>
                {listenButton(expect[target])}
              </p>
              <p class="gloss" lang={nat}>
                {expect[nat]}
              </p>
              {hear.length > 0 && (
                <>
                  <h2>{t('hear_label')}</h2>
                  <ul class="hear" lang={target}>
                    {hear.map((q) => (
                      <li>{q}</li>
                    ))}
                  </ul>
                </>
              )}
              <h2>{t('card_how_it_ends')}</h2>
              <p lang={target}>{scene.success[target]}</p>
              <p class="gloss" lang={nat}>
                {scene.success[nat]}
              </p>
            </>
          ) : (
            <>
              <h2>{t('expected')}</h2>
              <p lang={target}>{scene.success[target]}</p>
              <p class="gloss" lang={nat}>
                {scene.success[nat]}
              </p>
            </>
          )}
          {/* On a call there is nobody to show a line to; it is said. */}
          <h2>{t(scene.channel === 'phone' ? 'say_line' : 'staff_line')}</h2>
          <p class="staff-line with-voice">
            <span lang={target}>{scene.show_staff_line[target]}</span>
            {listenButton(scene.show_staff_line[target])}
          </p>
        </div>
      </article>
      <p class="gocard-actions">
        <a class="primary" href={placesHref}>
          {t('where_real')}
        </a>
      </p>
    </section>
  )
}
