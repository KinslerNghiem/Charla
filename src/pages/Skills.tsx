import { useEffect, useRef, useState } from 'preact/hooks'
import { SKILLS, phrasesIn, skillById, type SkillDef } from '../skills/skills'
import { judgeDrill, type Verdict } from '../skills/intents'
import { markTried, resetSkills, setAgain, skillsStore, statusOf } from '../skills/progress'
import { sceneById } from '../content/scenes'
import { lang, learning, native, t } from '../i18n/lang'
import { get } from '../storage'
import { classify, detectTier, startListener, type Listener, type TalkError } from '../speech/input'
import { hushVoice, unlockVoice } from '../speech/voice'
import { Icon } from '../ui/Icon'
import { ListenButton, useListen } from '../ui/ListenButton'

// The Skills section: eight transferable moves (ask for a repeat, confirm a
// date, say you lack a word…), each with an explanation, an example, the lines
// to say, a short drill and the scenes where it comes up. The definitions are
// data in src/skills/skills.ts; the drill's judgment is the same classifier the
// conversation uses (src/skills/intents.ts), so what passes here is what gets
// recognized there. Progress lives on the device and resets from this page.

export function Skills({ params }: { params: URLSearchParams }) {
  const skill = skillById(params.get('skill'))
  if (!skill) return <SkillList />
  // Keyed on the skill so moving between skills starts the detail fresh.
  return <SkillDetail skill={skill} drillOpen={params.get('drill') === '1'} key={skill.id} />
}

function SkillList() {
  const ui = lang()
  const target = learning()
  const [store, setStore] = useState(skillsStore)
  const [cleared, setCleared] = useState(false)
  return (
    <section class="skills">
      <h1>{t('skills_title')}</h1>
      <p class="note intro">{t('skills_intro')}</p>
      <ul class="skill-list">
        {SKILLS.map((s) => {
          const status = statusOf(store, s.id)
          const again = store[s.id]?.again === true
          return (
            <li>
              <a class="skill-card" href={`#/skills?skill=${s.id}`}>
                <span class="band">
                  <Icon name="skills" size={18} />
                </span>
                <span class="body">
                  <span class="title">{s.name[ui]}</span>
                  <span class="sub" lang={target}>
                    {s.phrases[0][target]}
                  </span>
                  {(status !== 'new' || again) && (
                    <span class="tags">
                      {status === 'used' && (
                        <span class="tag done">
                          <Icon name="check" size={12} />
                          {t('skill_tag_used')}
                        </span>
                      )}
                      {status === 'tried' && <span class="tag">{t('skill_tag_tried')}</span>}
                      {again && <span class="tag again">{t('skill_tag_again')}</span>}
                    </span>
                  )}
                </span>
              </a>
            </li>
          )
        })}
      </ul>
      <p class="note">
        {t('skills_progress_note')}{' '}
        <button
          type="button"
          class="link"
          onClick={() => {
            resetSkills()
            setStore({})
            setCleared(true)
          }}
        >
          {t('skills_reset')}
        </button>
      </p>
      {cleared && (
        <p class="notice" role="status">
          {t('skills_reset_done')}
        </p>
      )}
    </section>
  )
}

function SkillDetail({ skill, drillOpen }: { skill: SkillDef; drillOpen: boolean }) {
  const ui = lang()
  const target = learning()
  const nat = native()
  const [store, setStore] = useState(skillsStore)
  const [drilling, setDrilling] = useState(drillOpen)
  const { speaking, toggle } = useListen(target)
  const again = store[skill.id]?.again === true
  const scenes = skill.scenes.map((id) => sceneById(id)).filter((s) => s !== undefined)
  return (
    <section class="skills skill-detail">
      <header class="scene-head">
        <a class="back" href="#/skills">
          <Icon name="back" size={18} />
          {t('skills_back')}
        </a>
        <h1>{skill.name[ui]}</h1>
        <p class="what">{skill.what[ui]}</p>
      </header>

      <h2>{t('skill_example')}</h2>
      <div class="exchange">
        <p class="line">
          <span lang={target}>{skill.example.partner[target]}</span>
          <ListenButton text={skill.example.partner[target]} speaking={speaking} onToggle={toggle} />
        </p>
        <p class="gloss" lang={nat}>
          {skill.example.partner[nat]}
        </p>
        <p class="line learner">
          <span lang={target}>{skill.example.learner[target]}</span>
          <ListenButton text={skill.example.learner[target]} speaking={speaking} onToggle={toggle} />
        </p>
        <p class="gloss learner" lang={nat}>
          {skill.example.learner[nat]}
        </p>
      </div>

      <h2>{t('skill_phrases')}</h2>
      <ol class="skill-phrases">
        {skill.phrases.map((p) => (
          <li>
            <span>
              <b lang={target}>{p[target]}</b>
              <i lang={nat}>{p[nat]}</i>
            </span>
            <ListenButton text={p[target]} speaking={speaking} onToggle={toggle} />
          </li>
        ))}
      </ol>

      {drilling ? (
        <SkillDrill skill={skill} onTried={() => setStore(skillsStore())} />
      ) : (
        <div class="row">
          <button
            type="button"
            class="primary"
            onClick={() => {
              // The tap that opens the drill is the gesture that unlocks audio, so the cue can be read.
              unlockVoice()
              setDrilling(true)
            }}
          >
            {t('skill_practice')}
          </button>
          <button type="button" class="ghost" aria-pressed={again} onClick={() => setStore(setAgain(skill.id, !again))}>
            {again && <Icon name="check" size={16} />} {t('skill_again')}
          </button>
        </div>
      )}

      <h2>{t('skill_use_in')}</h2>
      <ul class="use-in">
        {scenes.map((s) => (
          <li>
            <a href={`#/learn?scene=${s.id}&skill=${skill.id}`}>
              <Icon name={s.place_type} size={20} />
              <span lang={target}>{s.title[target]}</span>
            </a>
          </li>
        ))}
      </ul>
    </section>
  )
}

type TalkState = 'idle' | 'opening' | 'listening' | 'working' | 'nothing' | TalkError

// Two cues, thirty to ninety seconds. The partner's line appears and is read
// aloud; the learner answers by typing or speaking; the classifier says whether
// the answer used the skill in the language being practiced. One sentence of
// feedback. A hit is recorded as "tried"; using the skill in a real
// conversation is what counts as "used".
function SkillDrill({ skill, onTried }: { skill: SkillDef; onTried: () => void }) {
  const ui = lang()
  const target = learning()
  const nat = native()
  const [round, setRound] = useState(0)
  const [answer, setAnswer] = useState('')
  const [verdict, setVerdict] = useState<Verdict | null>(null)
  const [listening, setListening] = useState(false)
  const [talk, setTalk] = useState<TalkState>('idle')
  const listener = useRef<Listener | null>(null)
  const alive = useRef(true)
  const { speaking, speak, toggle } = useListen(target)
  const tier = detectTier()
  const drill = skill.drills[round]
  const cue = drill.cue[target]
  const last = round === skill.drills.length - 1

  useEffect(
    () => () => {
      alive.current = false
      listener.current?.cancel()
    },
    [],
  )

  // Each cue is read as it appears, the way the partner's line would be said to you.
  useEffect(() => {
    if (get<boolean>('voice', true)) speak(cue)
  }, [round])

  function check(text: string) {
    const v = judgeDrill(text, skill.id, target, cue)
    setVerdict(v)
    if (v === 'hit') {
      markTried(skill.id)
      onTried()
    }
  }

  function next() {
    setRound((r) => r + 1)
    setAnswer('')
    setVerdict(null)
  }

  function toggleTalk() {
    if (tier === 'typed') return
    if (listening) {
      listener.current?.stop()
      return
    }
    unlockVoice()
    hushVoice()
    setTalk('opening')
    const fail = (err: unknown) => {
      setListening(false)
      setTalk(classify(err))
    }
    try {
      const l = startListener(tier, target, {
        expected: phrasesIn(skill, target),
        onOpen: () => setTalk('listening'),
        onWorking: () => {
          setListening(false)
          setTalk('working')
        },
      })
      listener.current = l
      if (!l) return
      setListening(true)
      l.result
        .then((text) => {
          if (!alive.current) return
          setListening(false)
          if (text) {
            setTalk('idle')
            setAnswer(text)
            check(text)
          } else {
            setTalk('nothing')
          }
        })
        .catch((err) => {
          if (alive.current) fail(err)
        })
    } catch (err) {
      fail(err)
    }
  }

  const status: Record<TalkState, string> = {
    idle: '',
    opening: t('talk_opening'),
    listening: t('talk_listening'),
    working: t('talk_working'),
    nothing: t('talk_nothing'),
    denied: t('talk_denied'),
    unavailable: t('talk_unavailable'),
    failed: t('talk_nothing'),
    capped: t('talk_capped'),
    offline: t('drill_offline'),
  }
  const working = talk === 'working'

  return (
    <div class="drill">
      <h2>
        {t('drill_title')} · {round + 1}/{skill.drills.length}
      </h2>
      <p class="note">{drill.hint[ui]}</p>
      <div class="partner">
        <p class="line" lang={target}>
          {cue}
        </p>
        <p class="gloss" lang={nat}>
          {drill.cue[nat]}
        </p>
        <ListenButton text={cue} speaking={speaking} onToggle={toggle} />
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          const text = answer.trim()
          if (text && !listening && !working) check(text)
        }}
      >
        <label class="sr-only" for="drill-answer">
          {t('drill_your_turn')}
        </label>
        <textarea
          id="drill-answer"
          value={answer}
          placeholder={t('drill_your_turn')}
          rows={2}
          lang={target}
          onInput={(e) => setAnswer((e.target as HTMLTextAreaElement).value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
              e.preventDefault()
              const text = answer.trim()
              if (text && !listening && !working) check(text)
            }
          }}
        />
        <div class="actions">
          {tier !== 'typed' ? (
            <button type="button" class={'talk' + (listening ? ' on' : '')} onClick={toggleTalk} disabled={working} aria-pressed={listening}>
              <Icon name={listening ? 'stop' : 'mic'} size={20} />
              {listening ? t('talk_stop') : t('talk_tap')}
            </button>
          ) : (
            <span class="note">{t('talk_unavailable')}</span>
          )}
          <button type="submit" class="primary" disabled={listening || working || !answer.trim()}>
            {t('drill_check')}
          </button>
        </div>
        {talk !== 'idle' && (
          <p class={'talk-status' + (listening ? ' on' : '')} aria-live="polite">
            {status[talk]}
          </p>
        )}
      </form>
      <div class="feedback" aria-live="polite">
        {verdict === 'hit' && (
          <p class="ok">
            <Icon name="check" size={16} /> {skill.done[ui]}
          </p>
        )}
        {verdict === 'other_lang' && <p>{t(target === 'en' ? 'drill_other_en' : 'drill_other_es')}</p>}
        {verdict === 'miss' && (
          <>
            <p>{t('drill_miss')}</p>
            <ul class="options">
              {skill.phrases.map((p) => (
                <li>
                  <button
                    type="button"
                    class="link"
                    lang={target}
                    onClick={() => {
                      setAnswer(p[target])
                      setVerdict(null)
                    }}
                  >
                    {p[target]}
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
      {verdict === 'hit' && !last && (
        <div class="row">
          <button type="button" class="primary" onClick={next}>
            {t('drill_next')}
          </button>
        </div>
      )}
      {verdict === 'hit' && last && <p class="done-note">{t('drill_done')}</p>}
      {verdict !== null && verdict !== 'hit' && (
        <div class="row">
          <button type="button" class="ghost" onClick={() => setVerdict(null)}>
            {t('drill_retry')}
          </button>
        </div>
      )}
    </div>
  )
}
