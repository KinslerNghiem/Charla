import { useEffect, useState } from 'preact/hooks'
import { useRoute } from './router'
import { get, set } from './storage'
import { lang, learning, setLang, setLearning, t, useLangTick } from './i18n/lang'
import { Gate } from './gate/Gate'
import { lowerOnly, type Mode } from './gate/gate'
import { Ninos } from './pages/Ninos'

// Kid mode is structurally offline, not just behaviourally: Ninos is the only
// page imported at module scope, and everything networked lives behind this
// dynamic import, so a child's browser never downloads the map or the API
// client at all.
type Pages = typeof import('./pages')
let cached: Pages | null = null

function usePages(enabled: boolean): Pages | null {
  const [pages, setPages] = useState<Pages | null>(cached)
  useEffect(() => {
    if (!enabled || cached) return
    let alive = true
    import('./pages').then((m) => {
      cached = m
      if (alive) setPages(m)
    })
    return () => {
      alive = false
    }
  }, [enabled])
  return pages
}

export function App() {
  useLangTick()
  const route = useRoute()
  const [mode, setMode] = useState<Mode | null>(() => get<Mode | null>('mode', null))
  const pages = usePages(mode !== null && mode !== 'kid')

  if (!mode) {
    return (
      <Gate
        onDone={(m) => {
          // A mode can be lowered (a parent handing the phone to a child) but
          // never raised without clearing site data.
          const next = lowerOnly(get<Mode | null>('mode', null), m)
          set('mode', next)
          setMode(next)
        }}
      />
    )
  }

  if (mode === 'kid') {
    return (
      <div class="shell kid">
        <header class="top">
          <span class="brand">{t('kids_title')}</span>
        </header>
        <main id="main">
          <Ninos />
        </main>
      </div>
    )
  }

  const links: [string, string][] = [
    ['/learn', t('nav_learn')],
    ['/places', t('nav_places')],
    ['/card', t('nav_card')],
    ['/table', t('nav_table')],
    ['/ninos', t('nav_kids')],
    ['/privacy', t('nav_privacy')],
  ]
  const current = route.path === '/' ? '/learn' : route.path

  let page
  if (!pages) {
    page = <p class="empty">{t('loading')}</p>
  } else {
    switch (route.path) {
      case '/places':
        page = <pages.Places params={route.params} />
        break
      case '/card':
        page = <pages.Card />
        break
      case '/table':
        page = <pages.Table params={route.params} />
        break
      case '/ninos':
        page = <Ninos />
        break
      case '/privacy':
        page = <pages.Privacy />
        break
      default:
        // Keyed on the scene so picking a new one starts a clean conversation.
        page = <pages.Learn key={route.params.get('scene') ?? 'picker'} params={route.params} mode={mode} />
    }
  }

  return (
    <div class="shell">
      {/* Moves focus without touching the hash: href="#main" alone would be a
          route change, and the router would swap the page out from under it. */}
      <a
        class="skip"
        href="#main"
        onClick={(e) => {
          e.preventDefault()
          document.getElementById('main')?.focus()
        }}
      >
        {t('skip_to_content')}
      </a>
      <header class="top">
        <a class="brand" href="#/learn">
          {t('app_name')}
        </a>
        <div class="switches">
          <button type="button" class="ghost" onClick={() => setLearning(learning() === 'en' ? 'es' : 'en')}>
            {learning() === 'en' ? t('learning_en') : t('learning_es')}
          </button>
          <button type="button" class="ghost" onClick={() => setLang(lang() === 'en' ? 'es' : 'en')} aria-label="Language">
            {t('ui_lang')}
          </button>
        </div>
      </header>
      <nav class="tabs" aria-label="Sections">
        {links.map(([path, label]) => (
          <a href={'#' + path} class={current === path ? 'on' : ''} aria-current={current === path ? 'page' : undefined}>
            {label}
          </a>
        ))}
      </nav>
      <main id="main" tabIndex={-1}>
        {page}
      </main>
    </div>
  )
}
