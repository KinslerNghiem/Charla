import type { Lang } from '../i18n/strings'

// The three free-text columns of a venue (who to ask for, when, the
// conversation group) come from the team's spreadsheet in English, with a
// Spanish column beside each. The Spanish interface reads the Spanish one and
// falls back to English only when the sheet has nothing there yet, so a
// Spanish reader is never shown "conversation group tutor" as long as the
// sheet is kept up.

export type VenueTextKey = 'roles' | 'shifts' | 'club_schedule'

export interface VenueText {
  roles?: string
  shifts?: string
  club_schedule?: string
  roles_es?: string
  shifts_es?: string
  club_schedule_es?: string
}

export function venueField(p: VenueText, key: VenueTextKey, lang: Lang): string {
  if (lang === 'es') {
    const es = p[`${key}_es`]
    if (es) return es
  }
  return p[key] ?? ''
}
