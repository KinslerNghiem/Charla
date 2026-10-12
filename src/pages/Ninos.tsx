import { useRef, useState } from 'preact/hooks'
import { kidScenes } from '../content/scenes'
import type { Scene } from '../content/scene.schema'
import { OfflineScene } from '../tutor/OfflineScene'
import { clearNative, learning, native, t, tIn } from '../i18n/lang'
import { clearAll, get, set } from '../storage'
import { speak } from '../speech/output'
import { placeIcon } from '../content/icons'
import { Icon } from '../ui/Icon'

// Charlita. This file and everything it imports must never touch the network:
// no requests to the Worker, no map tiles, no microphone, no location.
// tests/ninos-offline.test.ts scans the source to make sure it stays that way.


/** How long the Grown-ups button must be held. The kids_hold string says the same number. */
export const HOLD_MS = 3000

export function Ninos() {
  const [scene, setScene] = useState<Scene | null>(null)
  const [stickers, setStickers] = useState<string[]>(() => get<string[]>('stickers', []))
  const [earned, setEarned] = useState(false)
  const [grownups, setGrownups] = useState(false)
  const holdTimer = useRef<number | null>(null)
  const target = learning()
  const nat = native()

  function finish(s: Scene) {
    const next = stickers.includes(s.id) ? stickers : [...stickers, s.id]
    setStickers(next)
    set('stickers', next)
    setEarned(true)
  }

  function holdStart() {
    holdEnd()
    holdTimer.current = window.setTimeout(() => setGrownups(true), HOLD_MS)
  }
  function holdEnd() {
    if (holdTimer.current) clearTimeout(holdTimer.current)
    holdTimer.current = null
  }
  // The same hold from a keyboard: press and keep Enter or Space down.
  const isHoldKey = (e: KeyboardEvent) => e.key === 'Enter' || e.key === ' '
  function holdKeyDown(e: KeyboardEvent) {
    if (!isHoldKey(e)) return
    e.preventDefault()
    if (!e.repeat) holdStart()
  }
  function holdKeyUp(e: KeyboardEvent) {
    if (!isHoldKey(e)) return
    e.preventDefault()
    holdEnd()
  }

  if (grownups) {
    return (
      <section class="grownups">
        <h1>{t('kids_grownups')}</h1>
        <p>{t('kids_privacy')}</p>
        {/* The card is handed to the staff, so it is written in the language
            the child is practicing, whatever language the parent reads. */}
        <blockquote class="kid-card" lang={target}>
          {tIn(target, 'kids_card')}
        </blockquote>
        <p class="note">{t('kids_ready')}: ✂️</p>
        <button
          type="button"
          class="ghost"
          onClick={() => {
            setStickers([])
            set('stickers', [])
          }}
        >
          {t('clear_all')} ({t('kids_stickers')})
        </button>
        <button
          type="button"
          class="ghost"
          onClick={() => {
            clearNative()
            location.reload()
          }}
        >
          {t('kids_change_both')}
        </button>
        {/* Kid mode has no other way out: the gate only ever lowers a mode, so
            leaving it means clearing everything and answering again. */}
        <button
          type="button"
          class="danger"
          onClick={() => {
            clearAll()
            location.hash = '/'
            location.reload()
          }}
        >
          {t('kids_reset')}
        </button>
        <button type="button" class="primary" onClick={() => setGrownups(false)}>
          {t('back')}
        </button>
      </section>
    )
  }

  if (!scene) {
    return (
      <section class="ninos">
        <h1>{t('kids_pick')}</h1>
        <div class="street">
          {kidScenes().map((s) => (
            <button type="button" class="storefront" onClick={() => { setScene(s); setEarned(false) }}>
              <span class="pic" aria-hidden="true">
                {placeIcon(s.place_type)}
              </span>
              <span class="txt" lang={target}>
                {s.title[target]}
              </span>
              <span class="sub" lang={nat}>
                {s.title[nat]}
              </span>
              {stickers.includes(s.id) && <span class="sticker" aria-label={t('kids_stickers')}>⭐</span>}
            </button>
          ))}
        </div>
        <p class="stickers">
          {stickers.length ? `${t('kids_stickers')}: ${stickers.map(() => '⭐').join(' ')}` : t('kids_no_stickers')}
          {stickers.length >= kidScenes().length && ` · ${t('kids_ready')} 🎉`}
        </p>
        <button
          type="button"
          class="ghost hold"
          onPointerDown={holdStart}
          onPointerUp={holdEnd}
          onPointerCancel={holdEnd}
          onPointerLeave={holdEnd}
          onKeyDown={holdKeyDown}
          onKeyUp={holdKeyUp}
          onBlur={holdEnd}
        >
          {t('kids_grownups')} · {t('kids_hold')}
        </button>
      </section>
    )
  }

  return (
    <section class="ninos">
      <button type="button" class="back" onClick={() => setScene(null)}>
        <Icon name="back" size={18} />
        {t('back')}
      </button>
      <h1>
        {placeIcon(scene.place_type)} <span lang={target}>{scene.title[target]}</span>
      </h1>
      <OfflineScene scene={scene} learning={target} native={nat} pictures onDone={() => finish(scene)} />
      {earned && (
        <div class="done">
          <p class="big">⭐ {t('kids_sticker')}</p>
          <button type="button" class="ghost" onClick={() => speak(scene.show_staff_line[target], target, 0.8)}>
            <Icon name="speaker" size={16} /> {t('kids_say_it')}
          </button>
          <button type="button" class="primary" onClick={() => setScene(null)}>
            {t('back')}
          </button>
        </div>
      )}
    </section>
  )
}
