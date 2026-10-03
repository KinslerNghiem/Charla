import type { Lang } from '../i18n/strings'

// A place's badge, for ONE language. Businesses that listed themselves and
// public programs keep their own badge. Everything else is earned by visitors'
// one-tap reports, which lose half their weight every six months and expire
// after a year, so the map stays honest without anyone curating it.
//
// The server aggregates reports into 30-day buckets and a count of distinct
// devices before sending them, so no per-device identifier reaches the client
// and the response size does not grow with the number of reports.

export type Status = 'unknown' | 'reported' | 'confirmed' | 'listed_by_business' | 'listed_public'

export const STATUSES: Status[] = ['unknown', 'reported', 'confirmed', 'listed_by_business', 'listed_public']

export interface Bucket {
  /** 30-day bucket index: 0 is the last 30 days. */
  b: number
  positive: boolean
  n: number
}

export interface PlaceAgg {
  /** Distinct devices with a positive report in the last year, for this language. */
  devices: number
  buckets: Bucket[]
}

/** place id -> language -> aggregate. What GET /api/places returns. */
export type Reports = Record<string, Partial<Record<Lang, PlaceAgg>>>

const BUCKET_DAYS = 30

export function weight(ageDays: number): number {
  return Math.pow(0.5, ageDays / 182.5)
}

export function computeStatus(base: Status, agg: PlaceAgg | undefined): Status {
  if (base === 'listed_by_business' || base === 'listed_public') return base
  if (!agg) return 'unknown'
  let score = 0
  for (const bucket of agg.buckets) {
    if (bucket.b < 0 || bucket.b > 12) continue
    // Weigh each bucket at its midpoint. Far finer than the half-life.
    const w = weight(bucket.b * BUCKET_DAYS + BUCKET_DAYS / 2)
    score += (bucket.positive ? 1 : -1) * bucket.n * w
  }
  if (score >= 1.5 && agg.devices >= 2) return 'confirmed'
  if (score >= 0.5) return 'reported'
  return 'unknown'
}

/** The language a learner needs staff to fall back to: the one they are not learning. */
export function supportLang(learning: Lang): Lang {
  return learning === 'en' ? 'es' : 'en'
}
