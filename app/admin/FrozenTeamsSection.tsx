'use client'
import { useState, useEffect, useTransition } from 'react'
import { getFrozenTeams, revokeFreeze, type FrozenTeam } from '@/app/actions/admin'
import { createClient } from '@/lib/supabase/client'

const FREEZE_MS = 15 * 60 * 1000

function useCountdown(frozenSince: string) {
  const elapsed = Date.now() - new Date(frozenSince).getTime()
  const [ms, setMs] = useState(Math.max(0, FREEZE_MS - elapsed))

  useEffect(() => {
    setMs(Math.max(0, FREEZE_MS - (Date.now() - new Date(frozenSince).getTime())))
  }, [frozenSince])

  useEffect(() => {
    if (ms <= 0) return
    const interval = setInterval(() => {
      setMs(prev => Math.max(0, prev - 1000))
    }, 1000)
    return () => clearInterval(interval)
  }, [frozenSince]) // eslint-disable-line react-hooks/exhaustive-deps

  const totalSeconds = Math.ceil(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60).toString().padStart(2, '0')
  const seconds = (totalSeconds % 60).toString().padStart(2, '0')
  return { display: `${minutes}:${seconds}`, expired: ms <= 0 }
}

function FrozenTeamRow({ team, onRevoked }: { team: FrozenTeam; onRevoked: () => void }) {
  const { display, expired } = useCountdown(team.frozenSince)
  const [isPending, startTransition] = useTransition()

  function handleRevoke() {
    startTransition(async () => {
      await revokeFreeze(team.teamId, team.questionId)
      onRevoked()
    })
  }

  if (expired) return null

  return (
    <div className="flex items-center justify-between p-4 bg-red-500/5 border border-red-500/30 rounded-xl">
      <div className="flex items-center gap-5">
        <div className="text-2xl">🔒</div>
        <div>
          <p className="font-semibold text-white">{team.teamName}</p>
          <p className="text-xs text-gray-500 mt-0.5">Question {team.questionIndex}</p>
        </div>
        <div className="font-mono text-2xl font-bold text-red-400 tabular-nums">
          {display}
        </div>
      </div>
      <button
        onClick={handleRevoke}
        disabled={isPending}
        className="px-4 py-2 bg-brand-blue hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-50"
      >
        {isPending ? 'Revoking...' : 'Revoke Freeze'}
      </button>
    </div>
  )
}

export default function FrozenTeamsSection() {
  const [frozenTeams, setFrozenTeams] = useState<FrozenTeam[]>([])

  function refresh() {
    getFrozenTeams().then(setFrozenTeams)
  }

  useEffect(() => {
    refresh()

    const supabase = createClient()

    // Trigger refresh when a new wrong attempt comes in
    const attemptsChannel = supabase
      .channel('admin_frozen_attempts')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'attempts',
      }, (payload) => {
        if (payload.new && (payload.new as { is_correct: boolean }).is_correct === false) {
          refresh()
        }
      })
      .subscribe()

    // Trigger refresh when a freeze is revoked
    const overridesChannel = supabase
      .channel('admin_frozen_overrides')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'freeze_overrides',
      }, () => {
        refresh()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(attemptsChannel)
      supabase.removeChannel(overridesChannel)
    }
  }, [])

  if (frozenTeams.length === 0) return null

  return (
    <div className="mb-8">
      <div className="flex items-center gap-3 mb-3">
        <h3 className="text-lg font-semibold text-red-400">Frozen Teams</h3>
        <span className="text-xs bg-red-500/10 border border-red-500/30 text-red-400 px-2 py-0.5 rounded-full">
          {frozenTeams.length} active
        </span>
      </div>
      <div className="space-y-2">
        {frozenTeams.map(team => (
          <FrozenTeamRow key={team.teamId} team={team} onRevoked={refresh} />
        ))}
      </div>
    </div>
  )
}
