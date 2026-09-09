import { useEffect, useState } from 'preact/hooks'
import { SCENES, sceneById } from '../content/scenes'
import { buildTableScript, phaseAt, totalSeconds } from '../table/script'
import { lang, t } from '../i18n/lang'
import { askHelp } from '../tutor/client'
import type { Help } from '../tutor/turn'
import { go } from '../router'

export function Table({ params }: { params: URLSearchParams }) {
  const scene = sceneById(params.get('scene')) ?? SCENES[0]
  const phases = buildTableScript(scene)
  const ui = lang()
  const [running, setRunning] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [helpText, setHelpText] = useState('')
  const [help, setHelp] = useState<Help | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!running) return
    const t0 = Date.now() - elapsed * 1000
    const total = totalSeconds(phases)
    const id = setInterval(() => {
      const secs = Math.floor((Date.now() - t0) / 1000)
      setElapsed(secs)
      // Stop once the script is over, or the finished screen re-renders twice a
      // second for as long as the phone stays on it.
      if (secs >= total) clearInterval(id)
    }, 500)
    return () => clearInterval(id)
  }, [running])

  const at = phaseAt(phases, elapsed)
  const finished = running && at === null
  const phase = at ? phases[at.index] : null

  async function getHelp(e: Event) {
    e.preventDefault()
    if (!phase || !helpText.trim()) return
    setBusy(true)
    try {
      const from = phase.lang === 'en' ? 'es' : 'en'
      setHelp(await askHelp(helpText.trim(), from, phase.lang))
    } catch {
      setHelp({ phrase: '', literal: '', tip: t('table_help_unavailable') })
    } finally {
      setBusy(false)
    }
  }

  return (
    <section class="table">
      <h1>{t('table_title')}</h1>
      <p class="intro">{t('table_intro')}</p>
      <p class="not-recorded">🔒 {t('table_not_recorded')}</p>
      {!running && (
        <>
          <p class="notice">{t('table_checklist')}</p>
          <label>
            {t('pick_scene')}
            <select value={scene.id} onChange={(e) => go('/table', { scene: (e.target as HTMLSelectElement).value })}>
              {SCENES.filter((s) => !s.kid || s.id === scene.id).map((s) => (
                <option value={s.id}>{s.title[ui]}</option>
              ))}
            </select>
          </label>
          <button type="button" class="primary" onClick={() => setRunning(true)}>
            {t('table_start')} · {Math.round(totalSeconds(phases) / 60)} min
          </button>
        </>
      )}
      {phase && at && (
        <div class={'phase ' + phase.id}>
          <p class="timer" aria-live="polite">
            {Math.floor(at.remaining / 60)}:{String(at.remaining % 60).padStart(2, '0')}
          </p>
          <h2>{phase.id === 'switch' ? '⇄ ' : ''}{phase.title[ui]}</h2>
          <p class="lang-tag">{phase.lang === 'en' ? 'English' : 'Español'}</p>
          <ul class="prompts">
            {phase.prompts.map((p) => (
              <li>{p[phase.lang]}</li>
            ))}
          </ul>
          {/* The second person at the table never went through the gate and
              never saw the Rehearse screen, so the AI notice belongs here too. */}
          <p class="ai-banner">{t('ai_banner')}</p>
          <form class="help" onSubmit={getHelp}>
            <input value={helpText} placeholder={t('table_help_placeholder')} onInput={(e) => setHelpText((e.target as HTMLInputElement).value)} />
            <button type="submit" class="ghost" disabled={busy}>
              {t('table_help')}
            </button>
          </form>
          {help && (
            <div class="help-out">
              {help.phrase && <p class="line">{help.phrase}</p>}
              {help.literal && <p class="gloss">{help.literal}</p>}
              {help.tip && <p class="tip">{help.tip}</p>}
            </div>
          )}
          <button type="button" class="ghost" onClick={() => location.reload()}>
            {t('table_end')}
          </button>
        </div>
      )}
      {finished && (
        <div class="done">
          <p class="big">{t('table_done')}</p>
          <button type="button" class="primary" onClick={() => location.reload()}>
            {t('table_end')}
          </button>
        </div>
      )}
    </section>
  )
}
