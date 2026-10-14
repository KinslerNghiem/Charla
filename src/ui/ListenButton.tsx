import { useEffect, useState } from 'preact/hooks'
import type { Lang } from '../i18n/strings'
import { t } from '../i18n/lang'
import { hushVoice, say, unlockVoice } from '../speech/voice'
import { Icon } from './Icon'

// The speaker button next to a line, and the state behind it: which line is
// being read right now, so that line's button says Stop and every other one
// says Listen. The Go Card and the Skills page share it; the conversation
// page keeps its own, because it also reads replies as they arrive.

export function useListen(lang: Lang, rate = 1) {
  const [speaking, setSpeaking] = useState<string | null>(null)
  // Leaving the page stops the voice.
  useEffect(() => () => hushVoice(), [])
  function speak(text: string) {
    unlockVoice()
    setSpeaking(text)
    void say(text, lang, { rate, onEnd: () => setSpeaking((s) => (s === text ? null : s)) }).then((how) => {
      if (how === 'none' || how === 'superseded') setSpeaking((s) => (s === text ? null : s))
    })
  }
  function toggle(text: string) {
    if (speaking === text) {
      hushVoice()
      setSpeaking(null)
      return
    }
    speak(text)
  }
  return { speaking, speak, toggle }
}

export function ListenButton({ text, speaking, onToggle, size = 18 }: { text: string; speaking: string | null; onToggle: (text: string) => void; size?: number }) {
  const on = speaking === text
  return (
    <button type="button" class={'ghost small listen' + (on ? ' speaking' : '')} onClick={() => onToggle(text)} aria-label={`${on ? t('stop_voice') : t('listen')}: ${text}`}>
      <Icon name={on ? 'stop' : 'speaker'} size={size} />
    </button>
  )
}
