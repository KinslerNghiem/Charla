import { describe, expect, it } from 'vitest'
import { computeStatus, supportLang, weight, type PlaceAgg } from '../src/places/badges'

// Buckets are 30 days wide; bucket 0 is the last 30 days.
const agg = (devices: number, buckets: PlaceAgg['buckets']): PlaceAgg => ({ devices, buckets })

describe('venue badges', () => {
  it('a business listing or public program keeps its own badge', () => {
    expect(computeStatus('listed_by_business', undefined)).toBe('listed_by_business')
    expect(computeStatus('listed_public', agg(0, [{ b: 0, positive: false, n: 5 }]))).toBe('listed_public')
  })

  it('a place with no reports is unknown', () => {
    expect(computeStatus('unknown', undefined)).toBe('unknown')
    expect(computeStatus('unknown', agg(0, []))).toBe('unknown')
  })

  it('one fresh report makes a place Reported', () => {
    expect(computeStatus('unknown', agg(1, [{ b: 0, positive: true, n: 1 }]))).toBe('reported')
  })

  it('two fresh reports from two devices make it Confirmed', () => {
    expect(computeStatus('unknown', agg(2, [{ b: 0, positive: true, n: 2 }]))).toBe('confirmed')
  })

  it('two reports from the same device do not confirm', () => {
    expect(computeStatus('unknown', agg(1, [{ b: 0, positive: true, n: 2 }]))).toBe('reported')
  })

  it('reports lose half their weight every six months and expire after a year', () => {
    expect(weight(0)).toBe(1)
    expect(weight(182.5)).toBeCloseTo(0.5, 5)
    // Bucket 13 and beyond is older than a year and is ignored entirely.
    expect(computeStatus('unknown', agg(2, [{ b: 13, positive: true, n: 5 }]))).toBe('unknown')
    // Bucket 6 is about 195 days old: each report is worth under half.
    expect(computeStatus('unknown', agg(2, [{ b: 6, positive: true, n: 2 }]))).toBe('reported')
  })

  it('a "not anymore" report cancels a positive one', () => {
    const both = agg(1, [
      { b: 0, positive: true, n: 1 },
      { b: 0, positive: false, n: 1 },
    ])
    expect(computeStatus('unknown', both)).toBe('unknown')
  })

  it('the support language is the one the learner is not learning', () => {
    expect(supportLang('en')).toBe('es')
    expect(supportLang('es')).toBe('en')
  })
})
