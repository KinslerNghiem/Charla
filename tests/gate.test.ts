import { describe, expect, it } from 'vitest'
import { ageOn, lowerOnly, modeFor, validBirth } from '../src/gate/gate'

const now = new Date(2026, 8, 15) // Sept 15, 2026

describe('birth gate', () => {
  it('never overstates age when only month and year are known', () => {
    // Born September 2013: could turn 13 any day this month, so still 12.
    expect(ageOn(9, 2013, now)).toBe(12)
    // Born August 2013: definitely 13 by mid-September.
    expect(ageOn(8, 2013, now)).toBe(13)
  })

  it('routes to kid, teen, adult', () => {
    expect(modeFor(9, 2013, now)).toBe('kid')
    expect(modeFor(8, 2013, now)).toBe('teen')
    expect(modeFor(1, 2009, now)).toBe('teen')
    expect(modeFor(8, 2008, now)).toBe('adult')
  })

  it('only lowers a mode, never raises it', () => {
    expect(lowerOnly('adult', 'kid')).toBe('kid')
    expect(lowerOnly('kid', 'adult')).toBe('kid')
    expect(lowerOnly(null, 'teen')).toBe('teen')
  })

  it('rejects impossible dates', () => {
    expect(validBirth(13, 2010, now)).toBe(false)
    expect(validBirth(0, 2010, now)).toBe(false)
    expect(validBirth(5, 2027, now)).toBe(false)
    expect(validBirth(5, 2010, now)).toBe(true)
  })
})
