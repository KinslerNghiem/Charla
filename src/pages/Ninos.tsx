import { useRef, useState } from 'preact/hooks'
import { kidScenes } from '../content/scenes'
import type { Scene } from '../content/scene.schema'
import { OfflineScene } from '../tutor/OfflineScene'
import { learning, native, t } from '../i18n/lang'
import { get, set } from '../storage'
import { speak } from '../speech/output'

// Charlita. This file and everything it imports must never touch the network:
// no requests to the Worker, no map tiles, no microphone, no location.
// tests/ninos-offline.test.ts scans the source to make sure it stays that way.

const STREET: Record<string, string> = { restaurant: '🌮', library: '📚', pharmacy: '💊', grocery: '🛒' }

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
    holdTimer.current = window.setTimeout(() => setGrownups(true), 3000)
  }
  function holdEnd() {
    if (holdTimer.current) clearTimeout(holdTimer.current)
  }

  if (grownups) {
    return (
      <section class="grownups">
        <h1>{t('kids_grownups')}</h1>
        <p>{t('kids_privacy')}</p>
        <blockquote class="kid-card">{t('kids_card')}</blockquote>
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
                {STREET[s.place_type] ?? '🏪'}
              </span>
              <span class="txt">{s.title[target]}</span>
              <span class="sub">{s.title[nat]}</span>
              {stickers.includes(s.id) && <span class="sticker" aria-label={t('kids_stickers')}>⭐</span>}
            </button>
          ))}
        </div>
        <p class="stickers">
          {stickers.length ? `${t('kids_stickers')}: ${stickers.map(() => '⭐').join(' ')}` : t('kids_no_stickers')}
          {stickers.length >= kidScenes().length && ` · ${t('kids_ready')} 🎉`}
        </p>
        <button type="button" class="ghost small hold" onPointerDown={holdStart} onPointerUp={holdEnd} onPointerCancel={holdEnd} onPointerLeave={holdEnd}>
          {t('kids_grownups')} · {t('kids_hold')}
        </button>
      </section>
    )
  }

  return (
    <section class="ninos">
      <button type="button" class="ghost" onClick={() => setScene(null)}>
        ← {t('back')}
      </button>
      <h1>
        {STREET[scene.place_type] ?? '🏪'} {scene.title[target]}
      </h1>
      <OfflineScene scene={scene} learning={target} native={nat} pictures onDone={() => finish(scene)} />
      {earned && (
        <div class="done">
          <p class="big">⭐ {t('kids_sticker')}</p>
          <button type="button" class="ghost" onClick={() => speak(scene.show_staff_line[target], target, 0.8)}>
            🔊 {t('kids_say_it')}
          </button>
          <button type="button" class="primary" onClick={() => setScene(null)}>
            {t('back')}
          </button>
        </div>
      )}
    </section>
  )
}
