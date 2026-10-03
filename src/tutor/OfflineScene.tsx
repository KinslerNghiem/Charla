import { useState } from 'preact/hooks'
import type { Scene, ScriptChoice } from '../content/scene.schema'
import type { Lang } from '../i18n/strings'
import { t } from '../i18n/lang'
import { speak } from '../speech/output'

// The scripted version of a scene: the partner's line, two or three choices,
// a gentle retry on a wrong one. Used when the API is unreachable, and it is
// the whole of kid mode. No network. No free text.

export function OfflineScene({
  scene,
  learning,
  native,
  pictures = false,
  onDone,
}: {
  scene: Scene
  learning: Lang
  native: Lang
  pictures?: boolean
  onDone: () => void
}) {
  const [nodeId, setNodeId] = useState(scene.offline_script.start)
  const [tip, setTip] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  // Shown once, the first time Listen has nothing to say with.
  const [noVoice, setNoVoice] = useState(false)
  const node = scene.offline_script.nodes[nodeId]

  function choose(c: ScriptChoice) {
    if (c.best) {
      setTip(null)
      if (c.next === null) {
        setDone(true)
        onDone()
      } else {
        setNodeId(c.next)
      }
    } else {
      setTip(c.tip ? c.tip[native] : t('try_again'))
    }
  }

  function listen() {
    if (!speak(node.partner[learning], learning)) setNoVoice(true)
  }

  return (
    <div class="offline-scene">
      <div class="partner">
        <p class="line" lang={learning}>
          {node.partner[learning]}
        </p>
        <p class="gloss">{node.partner[native]}</p>
        <button type="button" class="ghost" onClick={listen}>
          🔊 {t('listen')}
        </button>
        {noVoice && <p class="note">{t(learning === 'es' ? 'no_voice_es' : 'no_voice_en')}</p>}
      </div>
      {tip && <p class="tip">{tip}</p>}
      {!done && (
        <div class="choices">
          {node.choices.map((c) => (
            <button type="button" class={'choice' + (pictures && c.picture ? '' : ' nopic')} onClick={() => choose(c)}>
              {pictures && c.picture && <span class="pic" aria-hidden="true">{c.picture}</span>}
              <span class="txt" lang={learning}>
                {c.text[learning]}
              </span>
              <span class="sub">{c.text[native]}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
