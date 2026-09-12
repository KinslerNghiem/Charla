import type { Scene } from '../scene.schema'
import pharmacy from './pharmacy-refill.json'
import clinic from './clinic-front-desk.json'
import driverServices from './driver-services-window.json'
import school from './school-office.json'
import taqueria from './taqueria-order.json'
import library from './library-card.json'
import grocery from './grocery-deli.json'
import iceCream from './ice-cream-shop.json'

// Add a scene: drop a JSON file next to these, import it here, run `npm test`
// (or `python scripts/check_scenes.py` without Node).
// All five must-have scenes from the plan are in; the rest are extras.
export const SCENES: Scene[] = [
  pharmacy as Scene,
  clinic as Scene,
  driverServices as Scene,
  school as Scene,
  taqueria as Scene,
  library as Scene,
  grocery as Scene,
  iceCream as Scene,
]

export function sceneById(id: string | null | undefined): Scene | undefined {
  return id ? SCENES.find((s) => s.id === id) : undefined
}

export function kidScenes(): Scene[] {
  return SCENES.filter((s) => s.kid)
}
