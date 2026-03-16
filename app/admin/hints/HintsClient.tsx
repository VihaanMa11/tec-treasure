'use client'
import { useState, useEffect } from 'react'
import { getPendingHints, markHintProvided, type HintRequest } from '@/app/actions/admin'
import { createClient } from '@/lib/supabase/client'

export default function HintsClient({ initialHints }: { initialHints: HintRequest[] }) {
  const [hints, setHints] = useState(initialHints)
  const [providingIds, setProvidingIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel('admin_hint_requests')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'hint_requests' }, () => {
        getPendingHints().then(setHints)
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [])

  async function handleProvide(id: string) {
    setProvidingIds(prev => new Set(prev).add(id))
    try {
      await markHintProvided(id)
      const updated = await getPendingHints()
      setHints(updated)
    } finally {
      setProvidingIds(prev => { const s = new Set(prev); s.delete(id); return s })
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h2 className="text-2xl font-bold text-white">Hint Requests</h2>
        <span className={`px-3 py-1 rounded-full text-sm font-medium ${
          hints.length > 0
            ? 'bg-amber-500/10 border border-amber-500/30 text-amber-400'
            : 'bg-gray-500/10 border border-gray-700 text-gray-500'
        }`}>
          {hints.length} pending
        </span>
      </div>

      {hints.length === 0 ? (
        <div className="text-center py-20 text-gray-600">
          <p className="text-4xl mb-4">✓</p>
          <p>No pending hint requests</p>
        </div>
      ) : (
        <div className="space-y-3">
          {hints.map(h => (
            <div
              key={h.id}
              className="flex items-center justify-between p-5 bg-brand-surface border border-amber-500/20 rounded-xl"
            >
              <div className="flex items-center gap-6">
                <div>
                  <p className="font-semibold text-white">{h.teamName}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Question {h.questionIndex} · Hint {h.hintNumber}
                  </p>
                </div>
                <div className="text-xs text-gray-600">
                  {new Date(h.requestedAt).toLocaleTimeString()}
                </div>
              </div>
              <button
                onClick={() => handleProvide(h.id)}
                disabled={providingIds.has(h.id)}
                className="px-5 py-2 bg-brand-gold hover:bg-amber-600 text-black font-semibold text-sm rounded-xl transition-colors disabled:opacity-50"
              >
                {providingIds.has(h.id) ? 'Providing...' : 'Mark Provided'}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
