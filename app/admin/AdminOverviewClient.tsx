'use client'
import { useState, useEffect, useTransition } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getAllTeamsProgress, startAllTeams, type TeamProgress } from '@/app/actions/admin'
import FrozenTeamsSection from './FrozenTeamsSection'

export default function AdminOverviewClient({ initialTeams }: { initialTeams: TeamProgress[] }) {
  const [teams, setTeams] = useState(initialTeams)
  const [isPending, startTransition] = useTransition()
  const [started, setStarted] = useState(false)

  function handleStart() {
    if (!confirm('Start the hunt for ALL teams? This will initialise their progress.')) return
    startTransition(async () => {
      await startAllTeams()
      const updated = await getAllTeamsProgress()
      setTeams(updated)
      setStarted(true)
    })
  }

  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel('admin_team_progress')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'team_progress' }, () => {
        getAllTeamsProgress().then(setTeams)
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  const completed = teams.filter(t => t.completedAt).length

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h2 className="text-2xl font-bold text-white">Live Team Progress</h2>
        <div className="flex items-center gap-3 text-sm">
          <span className="px-3 py-1 bg-green-500/10 border border-green-500/30 rounded-full text-green-400">
            {completed} Completed
          </span>
          <span className="px-3 py-1 bg-brand-blue/10 border border-brand-blue/30 rounded-full text-brand-blue-light">
            {teams.length - completed} In Progress
          </span>
          {started ? (
            <span className="px-4 py-1.5 bg-green-500/10 border border-green-500/30 rounded-xl text-green-400 text-sm font-medium">
              ✓ Hunt Started
            </span>
          ) : (
            <button
              onClick={handleStart}
              disabled={isPending}
              className="px-4 py-1.5 bg-brand-gold hover:bg-amber-600 text-black font-semibold rounded-xl transition-colors disabled:opacity-50 text-sm"
            >
              {isPending ? 'Starting...' : '🚀 Start Hunt'}
            </button>
          )}
        </div>
      </div>

      <FrozenTeamsSection />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {teams.map(team => (
          <div
            key={team.id}
            className={`p-5 rounded-2xl border ${
              team.completedAt
                ? 'border-green-500/40 bg-green-500/5'
                : 'border-brand-blue/20 bg-brand-surface card-glow'
            }`}
          >
            <div className="flex items-start justify-between mb-3">
              <div>
                <p className="font-semibold text-white text-sm">{team.teamName}</p>
                <p className="text-xs text-gray-500 mt-0.5">{team.email}</p>
              </div>
              {team.completedAt ? (
                <span className="text-xl">🏆</span>
              ) : (
                <span className="text-xs text-brand-blue-light font-mono bg-brand-blue/10 px-2 py-0.5 rounded">
                  Q{team.currentIndex}/10
                </span>
              )}
            </div>

            <div className="h-1.5 bg-brand-card rounded-full">
              <div
                className={`h-1.5 rounded-full transition-all duration-700 ${
                  team.completedAt ? 'bg-green-500' : 'bg-brand-blue'
                }`}
                style={{
                  width: `${team.completedAt ? 100 : ((team.currentIndex - 1) / 10) * 100}%`
                }}
              />
            </div>
            <p className="text-xs text-gray-600 mt-1.5">
              {team.completedAt
                ? 'Finished!'
                : `${team.currentIndex - 1} of 10 questions solved`}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}
