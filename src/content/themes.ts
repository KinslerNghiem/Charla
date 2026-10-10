import type { PlaceType, Scene } from './scene.schema'

// The picker's headings. A scene belongs to a theme through its place type,
// so a new scene lands under the right heading without another field, and a
// phone call always goes under "On the phone" whatever its place.
export type Theme = 'health' | 'school' | 'errands' | 'work_money'

export const THEMES: Theme[] = ['health', 'school', 'errands', 'work_money']

const THEME_OF: Record<PlaceType, Theme> = {
  pharmacy: 'health',
  clinic: 'health',
  school: 'school',
  park: 'school',
  college: 'school',
  restaurant: 'errands',
  grocery: 'errands',
  ice_cream: 'errands',
  library: 'errands',
  post_office: 'errands',
  transit: 'errands',
  driver_services: 'errands',
  bank: 'work_money',
  work: 'work_money',
  home: 'work_money',
}

export function themeOf(s: Scene): Theme {
  return THEME_OF[s.place_type]
}
