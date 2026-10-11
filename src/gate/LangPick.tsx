// The first screen. One question, asked in both languages because nothing is
// known yet: which language do you speak? The answer sets everything else.
// The interface, the tips, the level names and the goal are in that language;
// the partner speaks the other one. There is no separate "interface language"
// switch, because two independent switches confused every tester.

import type { Lang } from '../i18n/strings'
import { Mark } from '../ui/Icon'

export function LangPick({ onPick }: { onPick: (native: Lang) => void }) {
  return (
    <main class="gate langpick">
      <h1>
        <Mark size={36} />
        Charla
      </h1>
      <p class="tagline">
        Practica la conversación. Luego, tenla de verdad.
        <br />
        Practice the conversation. Then go have it.
      </p>
      <h2>
        ¿Qué idioma hablas? <span class="alt-q">Which language do you speak?</span>
      </h2>
      <div class="pick">
        <button type="button" class="big-pick" lang="es" onClick={() => onPick('es')}>
          <span class="band" aria-hidden="true" />
          <span class="body">
            Hablo español
            <small>Voy a practicar inglés</small>
          </span>
        </button>
        <button type="button" class="big-pick" lang="en" onClick={() => onPick('en')}>
          <span class="band" aria-hidden="true" />
          <span class="body">
            I speak English
            <small>I will practice Spanish</small>
          </span>
        </button>
      </div>
      <p class="note">
        Puedes cambiarlo después, abajo de cada página. <br />
        You can change this later, at the bottom of every page.
        <br />
        <a href="#/about">Acerca de Charla · About Charla</a>
      </p>
    </main>
  )
}
