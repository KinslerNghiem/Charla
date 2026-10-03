import { render } from 'preact'
import { registerSW } from 'virtual:pwa-register'
import { App } from './app'
import { t } from './i18n/lang'
import './style.css'

render(<App />, document.getElementById('app')!)

// A new build waits for a tap. Reloading on its own would drop a conversation
// in progress, and a learner at the counter with the Go Card open should not
// see the page blink. Plain DOM, outside Preact: it has to work even when the
// app tree is the thing that needs the update.
const updateSW = registerSW({
  onNeedRefresh() {
    if (document.querySelector('.update-bar')) return
    const bar = document.createElement('div')
    bar.className = 'update-bar'
    bar.setAttribute('role', 'status')
    const msg = document.createElement('span')
    msg.textContent = t('update_ready')
    const btn = document.createElement('button')
    btn.type = 'button'
    btn.className = 'primary'
    btn.textContent = t('update_reload')
    btn.onclick = () => {
      btn.disabled = true
      updateSW(true)
    }
    bar.append(msg, btn)
    document.body.append(bar)
  },
})
