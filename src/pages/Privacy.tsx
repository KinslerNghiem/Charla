import { useState } from 'preact/hooks'
import { t } from '../i18n/lang'
import { clearAll } from '../storage'

export function Privacy() {
  const [cleared, setCleared] = useState(false)
  return (
    <section class="privacy">
      <h1>{t('privacy_title')}</h1>
      <p>{t('privacy_body')}</p>
      <p>{t('kids_privacy')}</p>
      <button
        type="button"
        class="danger"
        onClick={() => {
          clearAll()
          setCleared(true)
          setTimeout(() => {
            location.hash = '/'
            location.reload()
          }, 600)
        }}
      >
        {t('clear_all')}
      </button>
      {cleared && <p class="notice">{t('cleared')}</p>}
    </section>
  )
}
