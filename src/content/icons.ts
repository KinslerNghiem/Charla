import type { PlaceType } from './scene.schema'

// One picture per place type, shared by the scene picker and Charlita's
// street so a taquería looks the same to a kid and to their parent. Emoji on
// purpose: no image files, nothing to fetch, and every phone has them.
export const PLACE_ICON: Record<PlaceType, string> = {
  pharmacy: '💊',
  restaurant: '🌮',
  clinic: '🩺',
  driver_services: '🪪',
  school: '🏫',
  grocery: '🛒',
  library: '📚',
  ice_cream: '🍦',
  home: '🏠',
  work: '🏢',
  college: '🎓',
  bank: '🏦',
  post_office: '📮',
  transit: '🚌',
  park: '🛝',
}

export function placeIcon(type: string): string {
  return PLACE_ICON[type as PlaceType] ?? '🏪'
}
