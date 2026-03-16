'use client'
import { useState, useTransition } from 'react'
import { resetTeamProgress, getAllTeamsProgress, type TeamProgress } from '@/app/actions/admin'

export default function TeamsClient({ initialTeams }: { initialTeams: TeamProgress[] }) {
  const [teams, setTeams] = useState(initialTeams)
  const [isPending, startTransition] = useTransition()
  const [resetting, setResetting] = useState<string | null>(null)
  const [resetDone, setResetDone] = useState<string | null>(null)

  function handleReset(teamId: string, teamName: string) {
    if (!confirm(`Reset all progress for ${teamName}? This cannot be undone.`)) return
    setResetting(teamId)
    startTransition(async () => {
      await resetTeamProgress(teamId)
      const updated = await getAllTeamsProgress()
      setTeams(updated)
      setResetting(null)
      setResetDone(teamId)
      setTimeout(() => setResetDone(null), 3000)
    })
  }

  return (
    <div>
      <h2 className="text-2xl font-bold text-white mb-8">Team Management</h2>

      <div className="border border-brand-blue/20 rounded-2xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-brand-blue/20 bg-brand-surface">
              <th className="text-left px-6 py-4 text-xs text-gray-500 uppercase tracking-widest">Team</th>
              <th className="text-left px-6 py-4 text-xs text-gray-500 uppercase tracking-widest">Email</th>
              <th className="text-left px-6 py-4 text-xs text-gray-500 uppercase tracking-widest">Progress</th>
              <th className="text-left px-6 py-4 text-xs text-gray-500 uppercase tracking-widest">Status</th>
              <th className="text-right px-6 py-4 text-xs text-gray-500 uppercase tracking-widest">Actions</th>
            </tr>
          </thead>
          <tbody>
            {teams.map((team, idx) => (
              <tr
                key={team.id}
                className={`border-b border-brand-blue/10 ${idx % 2 === 0 ? 'bg-brand-bg' : 'bg-brand-surface/30'}`}
              >
                <td className="px-6 py-4 font-medium text-white">{team.teamName}</td>
                <td className="px-6 py-4 text-gray-400 text-sm">{team.email}</td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-24 h-1.5 bg-brand-card rounded-full">
                      <div
                        className={`h-1.5 rounded-full ${team.completedAt ? 'bg-green-500' : 'bg-brand-blue'}`}
                        style={{ width: `${team.completedAt ? 100 : ((team.currentIndex - 1) / 10) * 100}%` }}
                      />
                    </div>
                    <span className="text-xs text-gray-500">
                      {team.completedAt ? '10/10' : `${team.currentIndex - 1}/10`}
                    </span>
                  </div>
                </td>
                <td className="px-6 py-4">
                  {team.completedAt ? (
                    <span className="text-xs text-green-400 bg-green-500/10 px-2 py-1 rounded-full">Completed</span>
                  ) : team.currentIndex > 1 ? (
                    <span className="text-xs text-brand-blue-light bg-brand-blue/10 px-2 py-1 rounded-full">In Progress</span>
                  ) : (
                    <span className="text-xs text-gray-500 bg-gray-800 px-2 py-1 rounded-full">Not Started</span>
                  )}
                </td>
                <td className="px-6 py-4 text-right">
                  {resetDone === team.id ? (
                    <span className="text-xs text-green-400">✓ Reset</span>
                  ) : (
                    <button
                      onClick={() => handleReset(team.id, team.teamName)}
                      disabled={isPending && resetting === team.id}
                      className="text-xs text-red-400 hover:text-red-300 border border-red-500/30 hover:border-red-500/60 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                    >
                      {resetting === team.id ? 'Resetting...' : 'Reset Progress'}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
