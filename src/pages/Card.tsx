import { useEffect, useState } from 'preact/hooks'
import { sceneById } from '../content/scenes'
import { learning, native, t } from '../i18n/lang'
import { get } from '../storage'
import { hushVoice, say, unlockVoice } from '../speech/voice'

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
  const [speaking, setSpeaking] = useState<string | null>(null)
  useEffect(() => () => hushVoice(), [])
  function listen(text: string) {
    if (speaking === text) {
      hushVoice()
      setSpeaking(null)
      return
    }
    unlockVoice()
    setSpeaking(text)
    void say(text, target, { onEnd: () => setSpeaking((s) => (s === text ? null : s)) }).then((how) => {
      if (how === 'none' || how === 'superseded') setSpeaking((s) => (s === text ? null : s))
    })
  }
  const listenButton = (text: string) => (
    <button
      type="button"
      class={'ghost small listen' + (speaking === text ? ' speaking' : '')}
      onClick={() => listen(text)}
      aria-label={`${speaking === text ? t('stop_voice') : t('listen')}: ${text}`}
    >
      {speaking === text ? '⏹' : '🔊'}
    </button>
  )
  if (!card || !scene) {
    return (
      <section class="card">
        <div class="empty-state">
          <span class="glyph" aria-hidden="true">
            🪪
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
                  <i>{p[nat]}</i>
                </span>
                {listenButton(p[target])}
              </li>
            ))}
          </ol>
          {expect ? (
            <>
              <h2>{t('expected')}</h2>
              <p class="expect with-voice">
                <span lang={target}>{expect[target]}</span>
                {listenButton(expect[target])}
              </p>
              <p class="gloss">{expect[nat]}</p>
              <h2>{t('card_how_it_ends')}</h2>
              <p lang={target}>{scene.success[target]}</p>
              <p class="gloss">{scene.success[nat]}</p>
            </>
          ) : (
            <>
              <h2>{t('expected')}</h2>
              <p lang={target}>{scene.success[target]}</p>
              <p class="gloss">{scene.success[nat]}</p>
            </>
          )}
          <h2>{t('staff_line')}</h2>
          <p class="staff-line with-voice">
            <span lang={target}>{scene.show_staff_line[target]}</span>
            {listenButton(scene.show_staff_line[target])}
          </p>
        </div>
      </article>
      <p class="gocard-actions">
        <a class="primary" href={`#/places?type=${encodeURIComponent(scene.place_type)}`}>
          {t('where_real')}
        </a>
      </p>
    </section>
  )
}
