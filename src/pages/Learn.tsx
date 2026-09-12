import { useEffect, useRef, useState } from 'preact/hooks'
import { SCENES, sceneById } from '../content/scenes'
import type { Scene } from '../content/scene.schema'
import { LEVELS, simplerThan, type Level } from '../tutor/levels'
import { ApiError, askTutor, flagReply, type HistoryItem } from '../tutor/client'
import { OfflineScene } from '../tutor/OfflineScene'
import { learning, native, t } from '../i18n/lang'
import { detectTier, startListener, type Listener } from '../speech/input'
import { speak, unlock } from '../speech/output'
import { set } from '../storage'
import { go } from '../router'
import type { Mode } from '../gate/gate'

interface Msg {
  role: 'user' | 'assistant'
  text: string
  tip?: string
  alt?: string[]
}

const BREAK_AFTER_MS = 30 * 60 * 1000

// app.tsx keys this component on the scene id, so picking a new scene remounts
// it and no state survives from the previous conversation.
export function Learn({ params }: { params: URLSearchParams; mode: Mode }) {
  const placeName = params.get('place') ?? undefined
  const sceneId = params.get('scene')
  const scene = sceneById(sceneId)
  const [level, setLevel] = useState<Level>('A2')
  const [msgs, setMsgs] = useState<Msg[]>([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [offline, setOffline] = useState(false)
  const [capped, setCapped] = useState(false)
  const [done, setDone] = useState(false)
  const [crisis, setCrisis] = useState(false)
  const [breakDue, setBreakDue] = useState(false)
  const [listening, setListening] = useState(false)
  const listener = useRef<Listener | null>(null)
  const started = useRef(Date.now())
  const tier = detectTier()
  const target = learning()
  const nat = native()

  useEffect(() => {
    const id = setInterval(() => {
      if (Date.now() - started.current > BREAK_AFTER_MS) setBreakDue(true)
    }, 60000)
    return () => clearInterval(id)
  }, [])

  if (!scene) return <ScenePicker onPick={(s) => go('/learn', { scene: s.id })} />

  function saveCard(s: Scene) {
    set('lastCard', { scene_id: s.id, place: placeName ?? null, level, ts: Date.now() })
  }

  async function send(text: string, command?: 'simpler' | 'another_way') {
    if (!scene || busy) return
    unlock()
    const history: HistoryItem[] = msgs.map((m) => ({ role: m.role, content: m.text }))
    const shown = command ? msgs : [...msgs, { role: 'user' as const, text }]
    setMsgs(shown)
    setInput('')
    setBusy(true)
    if (command === 'simpler') setLevel(simplerThan(level))
    try {
      const turn = await askTutor({
        scene_id: scene.id,
        level: command === 'simpler' ? simplerThan(level) : level,
        learning: target,
        history,
        user: text,
        command,
        place_name: placeName,
      })
      setMsgs([...shown, { role: 'assistant', text: turn.reply, tip: turn.tip || undefined, alt: turn.alt }])
      // A turn that works clears a previous blip, so one bad moment does not
      // lock the rest of the session into the scripted scene.
      setOffline(false)
      setCapped(false)
      speak(turn.reply, target)
      if (turn.safety_flag) setCrisis(true)
      if (turn.goal_reached) {
        saveCard(scene)
        setDone(true)
      }
    } catch (e) {
      // Out of turns for today is not the same as having no connection, and the
      // learner deserves to be told which one happened.
      if (e instanceof ApiError && e.status === 429) setCapped(true)
      else setOffline(true)
    } finally {
      setBusy(false)
    }
  }

  function pressTalk() {
    if (tier === 'typed' || listening) return
    try {
      listener.current = startListener(tier, target)
      setListening(true)
      listener.current?.result
        .then((text) => {
          setListening(false)
          if (text) send(text)
        })
        .catch(() => {
          // Leave whatever the learner had typed alone; the mic never wrote it.
          setListening(false)
        })
    } catch {
      setListening(false)
    }
  }

  function releaseTalk() {
    listener.current?.stop()
  }

  const lastAssistant = [...msgs].reverse().find((m) => m.role === 'assistant')

  // Shown in both branches: finishing the scripted scene earns the card too.
  const doneBlock = (
    <div class="done">
      <p class="big">{t('goal_reached')}</p>
      <a class="primary" href="#/card">
        {t('see_card')}
      </a>
    </div>
  )

  return (
    <section class="learn">
      <header class="scene-head">
        <button type="button" class="ghost" onClick={() => go('/learn')}>
          ← {t('back')}
        </button>
        <h1>{scene.title[target]}</h1>
        {placeName && <p class="place">{placeName}</p>}
        <p>
          <b>{t('goal_label')}:</b> {scene.goal[nat]}
        </p>
        <p class="must">
          <b>{t('must_use')}:</b>{' '}
          {scene.must_use.map((p) => (
            <span class="chip">
              {p[target]} <i>{p[nat]}</i>
            </span>
          ))}
        </p>
        <div class="levels" role="radiogroup" aria-label={t('pick_level')}>
          {LEVELS.map((l) => (
            <button type="button" role="radio" aria-checked={level === l} class={level === l ? 'on' : ''} onClick={() => setLevel(l)}>
              {t(`level_${l}` as 'level_A1')}
            </button>
          ))}
        </div>
      </header>

      {capped && <p class="notice">{t('daily_cap')}</p>}

      {offline || capped ? (
        <>
          {offline && (
            <p class="notice">
              {t('offline_mode')}{' '}
              <button type="button" class="small" onClick={() => setOffline(false)}>
                {t('offline_retry')}
              </button>
            </p>
          )}
          <OfflineScene
            scene={scene}
            learning={target}
            native={nat}
            onDone={() => {
              saveCard(scene)
              setDone(true)
            }}
          />
          {done && doneBlock}
        </>
      ) : (
        <>
          <p class="ai-banner">{t('ai_banner')}</p>
          {breakDue && <p class="notice">{t('break_reminder')}</p>}
          <ol class="chat" aria-live="polite">
            {msgs.map((m) => (
              <li class={m.role}>
                <p class="line">{m.text}</p>
                {m.role === 'assistant' && (
                  <button type="button" class="ghost small" onClick={() => speak(m.text, target)}>
                    🔊 {t('listen')}
                  </button>
                )}
                {m.tip && (
                  <p class="tip">
                    <b>{t('tip_label')}:</b> {m.tip}
                  </p>
                )}
                {m.alt && m.alt.length > 0 && (
                  <ul class="alt">
                    {m.alt.map((a) => (
                      <li>{a}</li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ol>
          {crisis && <p class="crisis">{t('crisis')}</p>}
          {done ? (
            doneBlock
          ) : (
            <form
              class="composer"
              onSubmit={(e) => {
                e.preventDefault()
                const text = input.trim()
                if (text) send(text)
              }}
            >
              <textarea
                value={input}
                placeholder={msgs.length === 0 ? `${scene.roles.partner[target]}: …` : t('type_here')}
                onInput={(e) => setInput((e.target as HTMLTextAreaElement).value)}
                onKeyDown={(e) => {
                  // Enter sends, like every chat box; Shift+Enter keeps the newline.
                  if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
                    e.preventDefault()
                    const text = input.trim()
                    if (text && !busy) send(text)
                  }
                }}
                rows={2}
              />
              <div class="row">
                <button type="submit" class="primary" disabled={busy || !input.trim()}>
                  {t('send')}
                </button>
                {tier !== 'typed' ? (
                  <button
                    type="button"
                    class={'talk' + (listening ? ' on' : '')}
                    onPointerDown={pressTalk}
                    onPointerUp={releaseTalk}
                    onPointerCancel={releaseTalk}
                    onPointerLeave={releaseTalk}
                    disabled={busy}
                  >
                    🎤 {listening ? t('release') : t('hold_to_talk')}
                  </button>
                ) : (
                  <span class="note">{t('talk_unavailable')}</span>
                )}
              </div>
              {lastAssistant && (
                <div class="row">
                  <button type="button" class="ghost" disabled={busy || level === 'A1'} onClick={() => send('', 'simpler')}>
                    {t('simpler')}
                  </button>
                  <button type="button" class="ghost" disabled={busy} onClick={() => send('', 'another_way')}>
                    {t('another_way')}
                  </button>
                  <button
                    type="button"
                    class="ghost small"
                    onClick={() => flagReply(scene.id, lastAssistant.text, 'user_report').catch(() => {})}
                    title={t('report_reply_note')}
                  >
                    {t('report_reply')}
                  </button>
                </div>
              )}
              {msgs.length === 0 && (
                <p class="note">
                  {scene.roles.partner[nat]} ↔ {scene.roles.learner[nat]}
                </p>
              )}
            </form>
          )}
        </>
      )}
      {done && (
        <p>
          <a href="#/places">{t('where_real')}</a>
        </p>
      )}
    </section>
  )
}

function ScenePicker({ onPick }: { onPick: (s: Scene) => void }) {
  const target = learning()
  const nat = native()
  return (
    <section class="picker">
      <h1>{t('pick_scene')}</h1>
      <ul class="scenes">
        {SCENES.map((s) => (
          <li>
            <button type="button" class="scene-card" onClick={() => onPick(s)}>
              <span class="type">{t(`type_${s.place_type}` as 'type_pharmacy')}</span>
              <span class="title">{s.title[target]}</span>
              <span class="sub">{s.title[nat]}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}
