import { useEffect, useRef, useState } from 'preact/hooks'
import { SCENES, sceneById } from '../content/scenes'
import type { Scene } from '../content/scene.schema'
import { LEVELS, simplerThan, type Level } from '../tutor/levels'
import { ApiError, askTutor, flagReply, type HistoryItem } from '../tutor/client'
import { OfflineScene } from '../tutor/OfflineScene'
import { lang as uiLang, learning, native, other, setLearning, t } from '../i18n/lang'
import { classify, detectTier, distanceAdvice, paceAdvice, startListener, type ClipStats, type Distance, type Listener, type Pace, type TalkError } from '../speech/input'
import { hushVoice, say, unlockVoice } from '../speech/voice'
import { get, set } from '../storage'
import { go } from '../router'
import { Icon } from '../ui/Icon'
import { THEMES, themeOf } from '../content/themes'
import { initialFlow, isComplete, learnerTurn, likelyQuestions, partnerTurn, summarize, usedPhrase, RECOVERY_LINES, type FlowState } from '../tutor/flow'
import { detectSkills, withModelSkill } from '../skills/intents'
import { phrasesIn, skillById, type SkillId } from '../skills/skills'
import { markTried, recordUse } from '../skills/progress'

interface Msg {
  role: 'user' | 'assistant'
  text: string
  tip?: string
  alt?: string[]
  /** The Worker rewrote this reply down to the learner's level. */
  kept?: boolean
  /** The reply in the learner's own language, shown only on request. */
  gloss?: string
  /** One line the learner could say next, shown only on request. */
  suggest?: string
  /** The communication skills this learner line used (src/skills/intents.ts). */
  skills?: SkillId[]
}

const BREAK_AFTER_MS = 30 * 60 * 1000
/** The model only sees this much of the conversation; older turns are not what the next line hangs on. */
const HISTORY_TURNS = 10
/** After this many learner lines the Go Card is earned whether or not the model noticed. */
const CARD_AFTER_TURNS = 6
/**
 * The Worker reads this much of a turn and no more (MAX_USER_CHARS in
 * worker/src/tutor.ts). Clamped here too: a pasted paragraph would otherwise
 * ride along in the history of the next ten turns and push the request over
 * the Worker's body limit, which reads as "no connection".
 */
const MAX_USER_CHARS = 600

// The session starts when the app does, not when a scene mounts: Learn is
// keyed on the scene id, so a per-component clock would reset on every pick.
const sessionStart = Date.now()

/** Phone-call scenes are grouped apart: a call is a different kind of courage than a counter. */
function channelOf(s: Scene): 'counter' | 'phone' {
  return s.channel === 'phone' ? 'phone' : 'counter'
}

export { usedPhrase }

function reducedMotion(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
}

// app.tsx keys this component on the scene id, so picking a new scene remounts
// it and no state survives from the previous conversation.
export function Learn({ params }: { params: URLSearchParams }) {
  const placeName = params.get('place') ?? undefined
  const sceneId = params.get('scene')
  const scene = sceneById(sceneId)
  // Opened from the Skills page: one skill to look for a moment to use here.
  const focusSkill = skillById(params.get('skill'))
  const [level, setLevel] = useState<Level>('A2')
  const [msgs, setMsgs] = useState<Msg[]>([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  // 'net' is no connection at all; 'busy' is the Worker answering 5xx. Both show the scripted scene.
  const [offline, setOffline] = useState<false | 'net' | 'busy'>(false)
  const [capped, setCapped] = useState(false)
  const [done, setDone] = useState(false)
  // Where the errand stands: the state machine in src/tutor/flow.ts.
  const [flow, setFlow] = useState<FlowState>(() => initialFlow(sceneById(params.get('scene'))?.must_use.length ?? 0))
  const flowRef = useRef<FlowState>(flow)
  // The state before each real line, so "Try that again" can step back one.
  const flowStack = useRef<FlowState[]>([])
  const [showGloss, setShowGloss] = useState(false)
  const [showSuggest, setShowSuggest] = useState(false)
  const [crisis, setCrisis] = useState(false)
  const [breakDue, setBreakDue] = useState(false)
  const [listening, setListening] = useState(false)
  const [talkState, setTalkState] = useState<'idle' | 'opening' | 'listening' | 'working' | 'nothing' | 'faint' | TalkError>('idle')
  // What the last spoken clip sounded like: too far, too close, too fast, too slow, or fine.
  const [coach, setCoach] = useState<{ distance: Distance; pace: Pace } | null>(null)
  // The same advice about distance, live, while the mic is still open.
  const [hint, setHint] = useState<Distance>(null)
  // The line being read aloud right now, so its button can say Stop.
  const [speaking, setSpeaking] = useState<string | null>(null)
  const [voiceOn, setVoiceOn] = useState(() => get<boolean>('voice', true))
  // The goal, phrases and level fold away on a phone once the conversation starts.
  const [briefOpen, setBriefOpen] = useState(true)
  const [flagged, setFlagged] = useState<Record<string, 'sent' | 'failed'>>({})
  const [noVoice, setNoVoice] = useState(false)
  const listener = useRef<Listener | null>(null)
  const meter = useRef<HTMLElement | null>(null)
  const chat = useRef<HTMLOListElement | null>(null)
  // A transcript arrives long after the tap that asked for it, so send() reads
  // these instead of the state its closure was born with.
  const alive = useRef(true)
  const busyRef = useRef(false)
  const msgsRef = useRef<Msg[]>([])
  const levelRef = useRef<Level>('A2')
  const voiceOnRef = useRef(voiceOn)
  const stats = useRef<ClipStats | null>(null)
  msgsRef.current = msgs
  levelRef.current = level
  voiceOnRef.current = voiceOn
  flowRef.current = flow
  const tier = detectTier()
  const target = learning()
  const nat = native()
  const ui = uiLang()

  useEffect(() => {
    const id = setInterval(() => {
      if (Date.now() - sessionStart > BREAK_AFTER_MS) setBreakDue(true)
    }, 60000)
    return () => clearInterval(id)
  }, [])

  // Leaving the page closes the mic without sending the clip and stops the
  // voice; a late transcript or reply finds alive false and does nothing.
  useEffect(
    () => () => {
      alive.current = false
      listener.current?.cancel()
      hushVoice()
    },
    [],
  )

  useEffect(() => {
    if (scene) set('lastScene', scene.id)
  }, [scene?.id])

  // A new reply lands at the top of the screen rather than below the fold.
  useEffect(() => {
    const replies = chat.current?.querySelectorAll('li.assistant:not(.pending)')
    const el = replies?.[replies.length - 1]
    if (el && typeof el.scrollIntoView === 'function') el.scrollIntoView({ block: 'start', behavior: reducedMotion() ? 'auto' : 'smooth' })
  }, [msgs.length])

  if (!scene) return <ScenePicker onPick={(s) => go('/learn', { scene: s.id })} />

  function saveCard(s: Scene) {
    set('lastCard', { scene_id: s.id, place: placeName ?? null, level: levelRef.current, ts: Date.now() })
  }

  function finish() {
    if (!scene) return
    saveCard(scene)
    const had = get<string[]>('rehearsed', [])
    if (!had.includes(scene.id)) set('rehearsed', [...had, scene.id])
    setDone(true)
  }

  // The next scene to try: same theme and not yet rehearsed, else anything
  // not yet rehearsed, else nothing (the loop is complete, go have one for real).
  function nextScene(): Scene | undefined {
    if (!scene) return undefined
    const had = new Set([...get<string[]>('rehearsed', []), scene.id])
    const fresh = SCENES.filter((s) => !s.kid && !had.has(s.id))
    return fresh.find((s) => themeOf(s) === themeOf(scene)) ?? fresh[0]
  }

  // Beginners get the line a little slower; the voice keeps its pitch.
  function read(text: string) {
    setSpeaking(text)
    say(text, target, {
      rate: levelRef.current === 'A1' ? 0.9 : 1,
      onEnd: () => alive.current && setSpeaking((s) => (s === text ? null : s)),
    }).then((how) => {
      if (!alive.current || how !== 'none') return
      setNoVoice(true)
      setSpeaking((s) => (s === text ? null : s))
    })
  }

  // `viaChip`: the line is one of the app's own (Repeat, What does that mean?),
  // so the skill in it counts as tried, not as used in the learner's own words.
  async function send(text: string, command?: 'simpler' | 'another_way', viaChip = false) {
    if (!scene || busyRef.current) return
    unlockVoice()
    // A mic message ("allow the microphone", "didn't catch that") is about the
    // last tap; once a turn goes out another way it has nothing left to say.
    setTalkState((s) => (s === 'opening' || s === 'listening' || s === 'working' ? s : 'idle'))
    const prev = msgsRef.current
    const history: HistoryItem[] = prev.slice(-HISTORY_TURNS).map((m) => ({ role: m.role, content: m.text }))
    // The communication skills in this line (asked for a repeat, confirmed a
    // date…), judged against what the partner just said. Shown under the bubble.
    const prevPartner = [...prev].reverse().find((m) => m.role === 'assistant')?.text
    const hits = command ? [] : detectSkills(text, { prevPartner })
    const shown = command ? prev : [...prev, { role: 'user' as const, text, skills: hits.length ? hits : undefined }]
    msgsRef.current = shown
    setMsgs(shown)
    setInput('')
    // The learner's line moves the errand along before the partner answers;
    // the Worker is told where it stands so it asks for what is still missing.
    const prevFlow = flowRef.current
    const asked = command ? learnerTurn(prevFlow, '', target, scene.must_use, 'command') : learnerTurn(prevFlow, text, target, scene.must_use)
    if (!command) flowStack.current.push(prevFlow)
    flowRef.current = asked
    setFlow(asked)
    setShowGloss(false)
    setShowSuggest(false)
    busyRef.current = true
    setBusy(true)
    const lvl = command === 'simpler' ? simplerThan(levelRef.current) : levelRef.current
    try {
      const turn = await askTutor({
        scene_id: scene.id,
        level: lvl,
        learning: target,
        history,
        user: text,
        command,
        place_name: placeName,
        phase: asked.phase,
        done: asked.done,
      })
      if (!alive.current) return
      // The level only drops once a simpler reply actually arrived.
      if (command === 'simpler') setLevel(lvl)
      const next: Msg[] = [
        ...shown,
        { role: 'assistant', text: turn.reply, tip: turn.tip || undefined, alt: turn.alt, kept: turn.kept_at_level, gloss: turn.gloss || undefined, suggest: turn.suggest || undefined },
      ]
      // Not understood: the partner asked them to say it again. The line stays
      // on screen with that reply under it, but nothing about it is credited.
      const heard = turn.understood !== false
      // The model may name a skill the patterns missed; the Worker has already
      // checked it is one of the eight. The learner's own words count as used,
      // the app's line behind a chip counts as tried.
      const skills = heard ? withModelSkill(hits, turn.skill, text, { prevPartner }) : []
      if (!command) {
        if (skills.length > 0 || !heard) next[next.length - 2] = { ...next[next.length - 2], skills: skills.length > 0 ? skills : undefined }
        for (const id of skills) viaChip ? markTried(id) : recordUse(id, scene.id)
      }
      msgsRef.current = next
      setMsgs(next)
      // A line that was not understood did not happen, as far as the errand goes.
      // The summary's "one thing to watch" is a correction, so only a tip that
      // came with a corrected sentence is remembered; a "now say" tip is not.
      const after = heard ? partnerTurn(asked, { ...turn, tip: turn.alt.length > 0 ? turn.tip : '' }) : prevFlow
      flowRef.current = after
      setFlow(after)
      // A turn that works clears a previous blip, so one bad moment does not
      // lock the rest of the session into the scripted scene.
      setOffline(false)
      setCapped(false)
      if (voiceOnRef.current) read(turn.reply)
      // On a phone the first reply is the cue to get the brief out of the way,
      // so the conversation and the mic share the screen.
      if (prev.length === 0 && typeof matchMedia === 'function' && matchMedia('(max-width: 899px)').matches) setBriefOpen(false)
      if (turn.safety_flag) setCrisis(true)
      // The success condition is decided in code (src/tutor/flow.ts), not by
      // the model alone: what was covered, and whether the partner closed.
      if (isComplete(after)) finish()
    } catch (e) {
      if (!alive.current) return
      // The line that got no answer goes back where it came from, so nothing
      // the learner wrote is lost to a bad moment on the network.
      msgsRef.current = prev
      setMsgs(prev)
      flowRef.current = prevFlow
      setFlow(prevFlow)
      if (!command) flowStack.current.pop()
      if (!command) setInput(text)
      // Out of turns for today, the Worker falling over, and no connection are
      // three different things, and the learner deserves to be told which.
      if (e instanceof ApiError && e.status === 429) setCapped(true)
      else if (e instanceof ApiError && e.status >= 500) setOffline('busy')
      else setOffline('net')
    } finally {
      if (alive.current) {
        busyRef.current = false
        setBusy(false)
      }
    }
  }

  // Tap, speak, pause. The clip stops itself after a pause, the words are sent
  // as the learner's turn, and the reply is read aloud, so a spoken exchange is
  // one tap per turn. Tapping again while it listens stops it early. What it
  // heard shows in the learner's bubble; a mishearing is fixed by saying it
  // again, the way it would be at a real counter.
  function toggleTalk() {
    if (tier === 'typed') return
    if (listening) {
      listener.current?.stop()
      return
    }
    unlockVoice()
    // Otherwise the mic records the phone reading the last reply.
    hushVoice()
    setSpeaking(null)
    setCoach(null)
    setHint(null)
    stats.current = null
    setTalkState('opening')
    const fail = (err: unknown) => {
      setListening(false)
      const kind = classify(err)
      // Speech has its own daily counter on the Worker, so a 429 here says
      // nothing about the typed turns: the status line says so and the
      // composer stays. Only a dead network switches to the scripted scene.
      if (kind === 'offline') setOffline('net')
      setTalkState(kind)
    }
    try {
      const l = startListener(tier, target, {
        expected: [...(scene?.must_use.map((p) => p[target]) ?? []), ...(focusSkill ? phrasesIn(focusSkill, target) : [])],
        onOpen: () => setTalkState('listening'),
        onLevel: (v) => {
          if (meter.current) meter.current.style.width = `${Math.round(v * 100)}%`
        },
        onWorking: () => {
          // The mic is closed; the button goes back to rest while the status line waits.
          setListening(false)
          setTalkState('working')
        },
        onStats: (s) => {
          stats.current = s
        },
        onHint: (h) => alive.current && setHint(h),
      })
      listener.current = l
      if (!l) return
      setListening(true)
      l.result
        .then((text) => {
          if (!alive.current) return
          setListening(false)
          setHint(null)
          const st = stats.current
          if (text) {
            // Only a recorded clip has levels to judge; the browser's own recogniser does not.
            if (st) setCoach({ distance: distanceAdvice(st), pace: paceAdvice(text, st.speechMs, target) })
            setTalkState('idle')
            send(text)
          } else {
            // "Too far away" is a different problem from "said nothing", and has a different fix.
            setTalkState(st?.faint ? 'faint' : 'nothing')
          }
        })
        .catch((err) => {
          if (alive.current) fail(err)
        })
    } catch (err) {
      fail(err)
    }
  }

  function listen(text: string) {
    if (speaking === text) {
      hushVoice()
      setSpeaking(null)
      return
    }
    unlockVoice()
    read(text)
  }

  function report(text: string) {
    if (!scene) return
    flagReply(scene.id, text, 'user_report')
      .then(() => alive.current && setFlagged((f) => ({ ...f, [text]: 'sent' })))
      .catch(() => alive.current && setFlagged((f) => ({ ...f, [text]: 'failed' })))
  }

  // One exchange back: the learner's last line returns to the box and the
  // reply to it is forgotten, so the line can be tried again. Nothing else
  // resets: the level, the earlier turns and the flow before that line stay.
  function retryLast() {
    if (!scene || busyRef.current) return
    const prev = msgsRef.current
    const i = prev.map((m) => m.role).lastIndexOf('user')
    if (i < 0) return
    const kept = prev.slice(0, i)
    msgsRef.current = kept
    setMsgs(kept)
    setInput(prev[i].text)
    const back = flowStack.current.pop() ?? initialFlow(scene.must_use.length)
    flowRef.current = back
    setFlow(back)
    setShowGloss(false)
    setShowSuggest(false)
    setDone(false)
  }

  const talkStatus: Record<typeof talkState, string> = {
    idle: '',
    opening: t('talk_opening'),
    listening: t('talk_listening'),
    working: t('talk_working'),
    nothing: t('talk_nothing'),
    faint: t('talk_faint'),
    denied: t('talk_denied'),
    unavailable: t('talk_unavailable'),
    failed: t('talk_nothing'),
    capped: t('talk_capped'),
    offline: t('talk_offline'),
  }
  const working = talkState === 'working'

  const lastAssistant = [...msgs].reverse().find((m) => m.role === 'assistant')
  const learnerLines = msgs.filter((m) => m.role === 'user')
  const skillsUsed = [...new Set(learnerLines.flatMap((m) => m.skills ?? []))]
  // Covered lines: the learner said them, said them their own way (the
  // scene's key words), or the partner reported the step. See src/tutor/flow.ts.
  const used = flow.done
  const hear = likelyQuestions(scene, target)
  const summary = done ? summarize(flow, scene.must_use, level) : null
  const earned = !done && (used.every(Boolean) || learnerLines.length >= CARD_AFTER_TURNS)
  const noVoiceNote = noVoice && <p class="note">{t(target === 'es' ? 'no_voice_es' : 'no_voice_en')}</p>

  // Shown in both branches: finishing the scripted scene earns the card too.
  const upNext = done ? nextScene() : undefined
  const doneBlock = (
    <div class="done">
      <p class="big">{t('goal_reached')}</p>
      {summary && (
        <div class="summary">
          <h2>{t('summary_title')}</h2>
          {summary.communicated.length > 0 && (
            <p>
              <b>{t('summary_said')}:</b>{' '}
              {summary.communicated.map((p, i) => (
                <span lang={target}>{(i ? ' · ' : '') + p[target]}</span>
              ))}
            </p>
          )}
          {summary.missed.length > 0 && (
            <p>
              <b>{t('summary_missed')}:</b>{' '}
              {summary.missed.map((p, i) => (
                <span lang={target}>{(i ? ' · ' : '') + p[target]}</span>
              ))}
            </p>
          )}
          <p>
            <b>{t('summary_strength')}:</b> {t(`strength_${summary.strength}` as 'strength_all_phrases')}
          </p>
          <p>
            <b>{t('summary_next')}:</b>{' '}
            {summary.improvement.key === 'missing' ? (
              <>
                {t('improve_missing')} <span lang={target}>{summary.improvement.phrase[target]}</span>
              </>
            ) : summary.improvement.key === 'tip' ? (
              <>
                {t('improve_tip')} <span lang={nat}>{summary.improvement.text}</span>
              </>
            ) : (
              t(`improve_${summary.improvement.key}` as 'improve_fuller')
            )}
          </p>
          {skillsUsed.length > 0 && (
            <p>
              <b>{t('summary_skills')}:</b> {skillsUsed.map((id) => skillById(id)?.name[ui] ?? id).join(' · ')}
            </p>
          )}
          {focusSkill && !skillsUsed.includes(focusSkill.id) && (
            <p>
              {t('summary_skill_unused')} <a href={`#/skills?skill=${focusSkill.id}`}>{t('summary_skills_link')}</a>
            </p>
          )}
          {learnerLines.length > 0 && (
            <button type="button" class="ghost small" onClick={retryLast}>
              {t('summary_retry')}
            </button>
          )}
        </div>
      )}
      <a class="primary" href="#/card">
        {t('see_card')}
      </a>
      {upNext && (
        <button type="button" class="ghost" onClick={() => go('/learn', { scene: upNext.id })}>
          {t('next_scene')}: <span lang={target}>{upNext.title[target]}</span>
        </button>
      )}
    </div>
  )

  return (
    <section class="learn">
      <header class="scene-head">
        <button type="button" class="back" onClick={() => go('/learn')}>
          <Icon name="back" size={18} />
          {t('back')}
        </button>
        <h1 lang={target}>{scene.title[target]}</h1>
        {placeName && <p class="place">{placeName}</p>}
        <details class="brief" open={briefOpen} onToggle={(e) => setBriefOpen((e.currentTarget as HTMLDetailsElement).open)}>
          <summary>
            <span>{t('brief_label')}</span>
            <span class="phase">{t(`phase_${flow.phase}` as 'phase_start')}</span>
            <span class="progress">
              {used.filter(Boolean).length}/{scene.must_use.length} <Icon name="check" size={14} />
            </span>
          </summary>
        <p>
          <b>{t('goal_label')}:</b> <span lang={nat}>{scene.goal[nat]}</span>
        </p>
        <p class="levels-label">
          <b>{t('must_use')}:</b>
        </p>
        <ol class="must">
          {scene.must_use.map((p, i) => (
            <li class={used[i] ? 'done' : ''}>
              <span class="num" aria-hidden="true">
                {used[i] ? <Icon name="check" size={14} /> : i + 1}
              </span>
              <span>
                {used[i] && <span class="sr-only">✓ </span>}
                <span lang={target}>{p[target]}</span>
                <i lang={nat}>{p[nat]}</i>
              </span>
              <button
                type="button"
                class={'ghost small listen' + (speaking === p[target] ? ' speaking' : '')}
                onClick={() => listen(p[target])}
                aria-label={`${speaking === p[target] ? t('stop_voice') : t('listen')}: ${p[target]}`}
              >
                <Icon name={speaking === p[target] ? 'stop' : 'speaker'} size={18} />
              </button>
            </li>
          ))}
        </ol>
        {scene.example_details && <p class="note">{t('card_examples')}</p>}
        {focusSkill && (
          <div class="nudge">
            <span class="label">
              {t('nudge_try')}: {focusSkill.name[ui]}
            </span>
            <p class="line">
              <span lang={target}>{focusSkill.phrases[0][target]}</span>
              <button
                type="button"
                class={'ghost small listen' + (speaking === focusSkill.phrases[0][target] ? ' speaking' : '')}
                onClick={() => listen(focusSkill.phrases[0][target])}
                aria-label={`${speaking === focusSkill.phrases[0][target] ? t('stop_voice') : t('listen')}: ${focusSkill.phrases[0][target]}`}
              >
                <Icon name={speaking === focusSkill.phrases[0][target] ? 'stop' : 'speaker'} size={18} />
              </button>
            </p>
            <p class="gloss" lang={nat}>
              {focusSkill.phrases[0][nat]}
            </p>
          </div>
        )}
        {hear.length > 0 && (
          <>
            <p class="levels-label">
              <b>{t('hear_label')}:</b>
            </p>
            <ul class="hear" lang={target}>
              {hear.map((q) => (
                <li>{q}</li>
              ))}
            </ul>
          </>
        )}
        {/* Level names follow the interface language like every other control:
            the person choosing "beginner" reads it in the language they chose
            for the app, never in the one they are learning. */}
        <p class="levels-label" id="levels-label">
          <b>{t('pick_level')}:</b>
        </p>
        <div class="levels" role="radiogroup" aria-labelledby="levels-label">
          {LEVELS.map((l) => (
            <button type="button" role="radio" aria-checked={level === l} class={level === l ? 'on' : ''} onClick={() => setLevel(l)}>
              {/* "Beginner · a few words": the name on one line, the gloss under it. */}
              <b>{t(`level_${l}` as 'level_A1').split(' · ')[0]}</b>
              <small>{t(`level_${l}` as 'level_A1').split(' · ')[1] ?? ''}</small>
            </button>
          ))}
        </div>
        </details>
      </header>

      {capped && <p class="notice">{t('daily_cap')}</p>}
      {breakDue && <p class="notice">{t('break_reminder')}</p>}

      {offline || capped ? (
        <>
          {offline && (
            <p class="notice">
              {offline === 'busy' ? t('partner_busy') : t('offline_mode')}{' '}
              <button type="button" class="small" onClick={() => setOffline(false)}>
                {t('offline_retry')}
              </button>
            </p>
          )}
          <OfflineScene
            scene={scene}
            learning={target}
            native={nat}
            voice={(text, lang) => {
              unlockVoice()
              return say(text, lang, { rate: levelRef.current === 'A1' ? 0.9 : 1 }).then((how) => how !== 'none')
            }}
            readAloud={voiceOn}
            onDone={finish}
          />
          {done && doneBlock}
        </>
      ) : (
        <>
          <p class="ai-banner">{t('ai_banner')}</p>
          <ol class="chat" aria-live="polite" ref={chat}>
            {msgs.map((m) => (
              <li class={m.role}>
                <p class="line" lang={target}>
                  {m.text}
                </p>
                {m.role === 'assistant' && (
                  <button type="button" class={'ghost small' + (speaking === m.text ? ' speaking' : '')} onClick={() => listen(m.text)}>
                    <Icon name={speaking === m.text ? 'stop' : 'speaker'} size={16} /> {speaking === m.text ? t('stop_voice') : t('listen')}
                  </button>
                )}
                {m.kept && <p class="kept">{t('kept_at_level')}</p>}
                {m.role === 'user' && m.skills && m.skills.length > 0 && (
                  <p class="skill-tag">
                    <Icon name="check" size={12} /> {t('skill_used_tag')}: {m.skills.map((id) => skillById(id)?.name[ui] ?? id).join(' · ')}
                  </p>
                )}
                {m.tip && (
                  <p class="tip">
                    <b>{t('tip_label')}:</b> <span lang={nat}>{m.tip}</span>
                  </p>
                )}
                {m.alt && m.alt.length > 0 && (
                  <div class="alt">
                    <b>{t('alt_label')}:</b>
                    <ul>
                      {m.alt.map((a) => (
                        <li lang={target}>{a}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </li>
            ))}
            {busy && (
              <li class="assistant pending" aria-busy="true">
                <p class="line">
                  <span lang={target}>{scene.roles.partner[target]}</span>
                  <span class="dots" aria-hidden="true">
                    <i />
                    <i />
                    <i />
                  </span>
                </p>
              </li>
            )}
          </ol>
          {noVoiceNote}
          {crisis && <p class="crisis">{t('crisis')}</p>}
          {done ? (
            doneBlock
          ) : (
            <form
              // Before the first line the brief is open above and nothing is below,
              // so the composer sits in the flow; pinning it to the bottom then only
              // covered the end of the brief. It sticks once the chat has begun.
              class={'composer' + (msgs.length === 0 ? ' start' : '')}
              onSubmit={(e) => {
                e.preventDefault()
                const text = input.trim()
                if (text && !listening && !working) send(text)
              }}
            >
              <textarea
                value={input}
                placeholder={msgs.length === 0 ? `${scene.roles.partner[target]}: …` : t('type_here')}
                onInput={(e) => setInput((e.target as HTMLTextAreaElement).value)}
                maxLength={MAX_USER_CHARS}
                onKeyDown={(e) => {
                  // Enter sends, like every chat box; Shift+Enter keeps the newline.
                  // While the mic is open the transcript is about to arrive, so Enter waits.
                  if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
                    e.preventDefault()
                    const text = input.trim()
                    if (text && !busy && !listening && !working) send(text)
                  }
                }}
                rows={2}
              />
              <div class="actions">
                {tier !== 'typed' ? (
                  <button type="button" class={'talk' + (listening ? ' on' : '')} onClick={toggleTalk} disabled={busy || working} aria-pressed={listening}>
                    <Icon name={listening ? 'stop' : 'mic'} size={20} />
                    {listening ? t('talk_stop') : t('talk_tap')}
                  </button>
                ) : (
                  <span class="note">{t('talk_unavailable')}</span>
                )}
                {/* While a clip is being transcribed its words are about to arrive as the turn, so Send waits too. */}
                <button type="submit" class="primary" disabled={busy || listening || working || !input.trim()}>
                  {t('send')}
                </button>
              </div>
              {listening && (
                <div class="meter" aria-hidden="true">
                  <i ref={meter} />
                </div>
              )}
              {talkState !== 'idle' && (
                <p class={'talk-status' + (listening ? ' on' : '')} aria-live="polite">
                  {talkState === 'listening' && hint ? t(hint === 'closer' ? 'coach_live_closer' : 'coach_live_farther') : talkStatus[talkState]}
                </p>
              )}
              {coach && !listening && (
                <p class={'coach' + (coach.distance || coach.pace ? '' : ' ok')} aria-live="polite">
                  {coach.distance === 'closer' && <span>{t('coach_closer')}</span>}
                  {coach.distance === 'farther' && <span>{t('coach_farther')}</span>}
                  {coach.pace === 'slower' && <span>{t('coach_slower')}</span>}
                  {coach.pace === 'faster' && <span>{t('coach_faster')}</span>}
                  {!coach.distance && !coach.pace && (
                    <span>
                      <Icon name="check" size={16} /> {t('coach_good')}
                    </span>
                  )}
                </p>
              )}
              {earned && (
                <div class="row">
                  <button type="button" class="primary" onClick={finish}>
                    {t('make_card')}
                  </button>
                </div>
              )}
              {lastAssistant && (
                <>
                  {/* The ways out when lost: a repeat, a meaning, the last reply in your
                      own language, a line you could say next, or the last line again. */}
                  <div class="chips" role="group" aria-label={t('chips_label')}>
                    <button type="button" class="ghost small" disabled={busy} onClick={() => send(RECOVERY_LINES[target].repeat, undefined, true)}>
                      {t('chip_repeat')}
                    </button>
                    <button type="button" class="ghost small" disabled={busy} onClick={() => send(RECOVERY_LINES[target].meaning, undefined, true)}>
                      {t('chip_meaning')}
                    </button>
                    {lastAssistant.gloss && (
                      <button type="button" class="ghost small" aria-pressed={showGloss} onClick={() => setShowGloss((v) => !v)}>
                        {t('chip_translate')}
                      </button>
                    )}
                    {lastAssistant.suggest && (
                      <button type="button" class="ghost small" aria-pressed={showSuggest} onClick={() => setShowSuggest((v) => !v)}>
                        {t('chip_suggest')}
                      </button>
                    )}
                    <button type="button" class="ghost small" disabled={busy} onClick={retryLast}>
                      {t('chip_retry')}
                    </button>
                  </div>
                  {showGloss && lastAssistant.gloss && (
                    <p class="gloss-box" lang={nat}>
                      <b>{t('gloss_label')}:</b> {lastAssistant.gloss}
                    </p>
                  )}
                  {showSuggest && lastAssistant.suggest && (
                    <p class="suggest-box">
                      <b>{t('suggest_label')}:</b> <span lang={target}>{lastAssistant.suggest}</span>{' '}
                      <button type="button" class="link" onClick={() => setInput(lastAssistant.suggest ?? '')}>
                        {t('use_suggestion')}
                      </button>
                    </p>
                  )}
                  {/* One row: the two ways to get a different reply, and the voice switch at the far end. */}
                  <div class="row after-reply">
                    <button type="button" class="ghost" disabled={busy || level === 'A1'} onClick={() => send('', 'simpler')}>
                      {t('simpler')}
                    </button>
                    <button type="button" class="ghost" disabled={busy} onClick={() => send('', 'another_way')}>
                      {t('another_way')}
                    </button>
                    <label class="voice-toggle">
                      <input
                        type="checkbox"
                        checked={voiceOn}
                        onChange={(e) => {
                          const on = (e.currentTarget as HTMLInputElement).checked
                          setVoiceOn(on)
                          set('voice', on)
                          if (!on) {
                            hushVoice()
                            setSpeaking(null)
                          }
                        }}
                      />
                      <Icon name="speaker" size={16} /> {t('voice_label')}
                    </label>
                  </div>
                  {/* Reporting is a quiet link in its own explanation, not a third button. */}
                  <p class="note report" aria-live="polite">
                    {flagged[lastAssistant.text] === 'sent' ? (
                      t('report_reply_done')
                    ) : (
                      <>
                        {flagged[lastAssistant.text] === 'failed' ? t('report_reply_failed') : t('report_reply_note')}{' '}
                        <button type="button" class="link" onClick={() => report(lastAssistant.text)}>
                          {t('report_reply')}
                        </button>
                      </>
                    )}
                  </p>
                </>
              )}
              {msgs.length === 0 && (
                <p class="note" lang={nat}>
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
  const lastId = get<string>('lastScene', '')
  const last = SCENES.find((s) => s.id === lastId)
  const rehearsed = new Set(get<string[]>('rehearsed', []))
  const rest = SCENES.filter((s) => s !== last)
  const counter = rest.filter((s) => channelOf(s) === 'counter')
  const groups = [
    ...THEMES.map((th) => ({ key: `group_${th}` as 'group_health', scenes: counter.filter((s) => themeOf(s) === th) })),
    { key: 'group_phone' as const, scenes: rest.filter((s) => channelOf(s) === 'phone') },
  ].filter((g) => g.scenes.length > 0)

  const card = (s: Scene, isLast = false) => (
    <li>
      <button type="button" class="scene-card" onClick={() => onPick(s)}>
        {/* The band: the card's edge in the language it is for, with the place drawn on it. */}
        <span class="band">
          <Icon name={s.place_type} size={20} />
          {channelOf(s) === 'phone' && <Icon name="phone" size={16} />}
        </span>
        <span class="body">
          <span class="title" lang={target}>
            {s.title[target]}
          </span>
          <span class="sub" lang={nat}>
            {s.title[nat]}
          </span>
          {(isLast || s.kid || channelOf(s) === 'phone' || rehearsed.has(s.id)) && (
            <span class="tags">
              {rehearsed.has(s.id) && (
                <span class="tag done">
                  <Icon name="check" size={12} />
                  {t('rehearsed')}
                </span>
              )}
              {isLast && !rehearsed.has(s.id) && <span class="tag last">{t('last_used')}</span>}
              {channelOf(s) === 'phone' && <span class="tag">{t('phone_call')}</span>}
              {s.kid && <span class="tag">{t('kid_friendly')}</span>}
            </span>
          )}
        </span>
      </button>
    </li>
  )

  return (
    <section class="picker">
      <h1>{t('pick_scene')}</h1>
      {/* The direction, and the one place to change it: here, before a
          conversation starts, never in the middle of one. The interface
          language is a separate setting, up in the header. */}
      <p class="direction">
        <span>
          {t('direction_label')}: <b>{t(target === 'en' ? 'lang_name_en' : 'lang_name_es')}</b>
        </span>
        <button type="button" class="link" onClick={() => setLearning(other(target))}>
          {t(other(target) === 'en' ? 'direction_to_en' : 'direction_to_es')}
        </button>
      </p>
      {/* The whole app in one line, and each step is a way to get there. */}
      <ol class="steps" aria-label={t('steps_label')}>
        <li class="here">
          <span class="num">1</span>
          {t('step_rehearse')}
        </li>
        <li>
          <a href="#/card">
            <span class="num">2</span>
            {t('step_card')}
          </a>
        </li>
        <li>
          <a href="#/places">
            <span class="num">3</span>
            {t('step_go')}
          </a>
        </li>
      </ol>
      {/* The skills that work in every scene, one tap away before picking one. */}
      <a class="skills-entry" href="#/skills">
        <span class="band">
          <Icon name="skills" size={20} />
        </span>
        <span class="body">
          <span class="title">{t('skills_entry')}</span>
          <span class="sub">{t('skills_entry_sub')}</span>
        </span>
      </a>
      {last && <ul class="scenes">{card(last, true)}</ul>}
      {groups.map((g) => (
        <div class="scene-group">
          <h2>{t(g.key)}</h2>
          <ul class="scenes">{g.scenes.map((s) => card(s))}</ul>
        </div>
      ))}
    </section>
  )
}
