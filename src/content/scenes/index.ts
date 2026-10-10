import type { Scene } from '../scene.schema'
import pharmacy from './pharmacy-refill.json'
import clinic from './clinic-front-desk.json'
import driverServices from './driver-services-window.json'
import school from './school-office.json'
import conference from './parent-teacher-conference.json'
import taqueria from './taqueria-order.json'
import library from './library-card.json'
import grocery from './grocery-deli.json'
import iceCream from './ice-cream-shop.json'
import classroom from './classroom-help.json'
import landlord from './landlord-repair.json'
import sick from './call-in-sick.json'
import electricBill from './electric-bill-call.json'
import urgentCare from './urgent-care-symptoms.json'
import bank from './bank-open-account.json'
import postOffice from './post-office-package.json'
import parkDistrict from './park-district-signup.json'
import job from './job-application.json'
import college from './college-language-classes.json'
import bus from './bus-ride.json'
import playground from './playground-new-friend.json'
import doctorCall from './doctor-appointment-call.json'
import absenceCall from './school-absence-call.json'

// Add a scene: drop a JSON file next to these, import it here, run `npm test`
// (or `python scripts/check_scenes.py` without Node). The test suite checks
// that every JSON file in this folder is registered here.
// Order: counter scenes first (adult, then kid), then the phone calls.
export const SCENES: Scene[] = [
  pharmacy as Scene,
  clinic as Scene,
  driverServices as Scene,
  school as Scene,
  conference as Scene,
  taqueria as Scene,
  library as Scene,
  grocery as Scene,
  iceCream as Scene,
  classroom as Scene,
  urgentCare as Scene,
  bank as Scene,
  postOffice as Scene,
  parkDistrict as Scene,
  job as Scene,
  college as Scene,
  bus as Scene,
  playground as Scene,
  landlord as Scene,
  sick as Scene,
  electricBill as Scene,
  doctorCall as Scene,
  absenceCall as Scene,
]

export function sceneById(id: string | null | undefined): Scene | undefined {
  return id ? SCENES.find((s) => s.id === id) : undefined
}

export function kidScenes(): Scene[] {
  return SCENES.filter((s) => s.kid)
}
