import { describe, it, expect } from 'vitest'
import { getFreezeKey, isFrozen, getFreezeRemainingMs } from '../freeze'

describe('freeze utilities', () => {
  it('generates correct localStorage key', () => {
    expect(getFreezeKey('team-1', 'q-1')).toBe('freeze_until_team-1_q-1')
  })

  it('returns false when no freeze key in storage', () => {
    expect(isFrozen('team-1', 'q-1')).toBe(false)
  })

  it('returns true when freeze timestamp is in the future', () => {
    const future = new Date(Date.now() + 10 * 60 * 1000).toISOString()
    localStorage.setItem(getFreezeKey('team-1', 'q-1'), future)
    expect(isFrozen('team-1', 'q-1')).toBe(true)
    localStorage.clear()
  })

  it('returns false when freeze timestamp is in the past', () => {
    const past = new Date(Date.now() - 1000).toISOString()
    localStorage.setItem(getFreezeKey('team-1', 'q-1'), past)
    expect(isFrozen('team-1', 'q-1')).toBe(false)
    localStorage.clear()
  })

  it('returns remaining ms correctly', () => {
    const tenMinutes = 10 * 60 * 1000
    const future = new Date(Date.now() + tenMinutes).toISOString()
    localStorage.setItem(getFreezeKey('t', 'q'), future)
    const remaining = getFreezeRemainingMs('t', 'q')
    expect(remaining).toBeGreaterThan(tenMinutes - 1000)
    expect(remaining).toBeLessThanOrEqual(tenMinutes)
    localStorage.clear()
  })
})
