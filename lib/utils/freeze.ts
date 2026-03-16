export const FREEZE_DURATION_MS = 15 * 60 * 1000 // 15 minutes

export function getFreezeKey(teamId: string, questionId: string): string {
  return `freeze_until_${teamId}_${questionId}`
}

export function isFrozen(teamId: string, questionId: string): boolean {
  if (typeof window === 'undefined') return false
  const val = localStorage.getItem(getFreezeKey(teamId, questionId))
  if (!val) return false
  return new Date(val).getTime() > Date.now()
}

export function getFreezeRemainingMs(teamId: string, questionId: string): number {
  if (typeof window === 'undefined') return 0
  const val = localStorage.getItem(getFreezeKey(teamId, questionId))
  if (!val) return 0
  return Math.max(0, new Date(val).getTime() - Date.now())
}

export function setFreeze(teamId: string, questionId: string): void {
  const until = new Date(Date.now() + FREEZE_DURATION_MS).toISOString()
  localStorage.setItem(getFreezeKey(teamId, questionId), until)
}

export function clearFreeze(teamId: string, questionId: string): void {
  localStorage.removeItem(getFreezeKey(teamId, questionId))
}
