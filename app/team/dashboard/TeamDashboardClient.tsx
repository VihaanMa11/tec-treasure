'use client'
import { useState, useEffect, useTransition, useCallback } from 'react'
import { submitAnswer, getProvidedHints } from '@/app/actions/team'
import { isFrozen, getFreezeRemainingMs, setFreeze } from '@/lib/utils/freeze'
import { createClient } from '@/lib/supabase/client'
import type { DashboardData } from '@/app/actions/team'
import FreezeOverlay from './FreezeOverlay'
import HintSection from './HintSection'
import { useRouter } from 'next/navigation'

interface Props {
  initialData: DashboardData
  teamName: string
  teamId: string
}

const OPTIONS = ['a', 'b', 'c', 'd'] as const
const LABELS = ['A', 'B', 'C', 'D']

export default function TeamDashboardClient({ initialData, teamName, teamId }: Props) {
  const router = useRouter()
  // initialData comes fresh from server on each router.refresh() remount
  const data = initialData
  const [selectedOption, setSelectedOption] = useState<string | null>(null)
  const [result, setResult] = useState<{ correct: boolean; clue: string } | null>(null)
  const [frozen, setFrozen] = useState(false)
  const [freezeMs, setFreezeMs] = useState(0)
  const [providedHints, setProvidedHints] = useState<number[]>([])
  const [isPending, startTransition] = useTransition()

  const question = data.status === 'active' ? data.question : null

  useEffect(() => {
    if (!question) return
    if (isFrozen(teamId, question.id)) {
      setFrozen(true)
      setFreezeMs(getFreezeRemainingMs(teamId, question.id))
    }
  }, [teamId, question])

  useEffect(() => {
    if (!question) return
    getProvidedHints(question.id).then(setProvidedHints)
  }, [question])

  useEffect(() => {
    if (!question) return
    const supabase = createClient()
    const channel = supabase
      .channel(`hints_${teamId}_${question.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'hint_requests',
          filter: `team_id=eq.${teamId}`,
        },
        () => {
          getProvidedHints(question.id).then(setProvidedHints)
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [teamId, question])

  const handleFreezeExpired = useCallback(() => {
    setFrozen(false)
    setFreezeMs(0)
  }, [])

  function handleSubmit() {
    if (!selectedOption || !question || isPending || frozen) return

    startTransition(async () => {
      const res = await submitAnswer(question.id, selectedOption)

      if (res.correct) {
        setResult({ correct: true, clue: res.clue! })
      } else {
        setFreeze(teamId, question.id)
        setFreezeMs(getFreezeRemainingMs(teamId, question.id))
        setFrozen(true)
        setSelectedOption(null)
      }
    })
  }

  function handleNextQuestion() {
    setResult(null)
    setSelectedOption(null)
    router.refresh()
  }

  if (data.status === 'waiting') {
    return (
      <div className="min-h-screen bg-brand-bg flex items-center justify-center p-4">
        <div className="text-center">
          <div className="text-6xl mb-6 animate-pulse">⏳</div>
          <h1 className="text-3xl font-bold text-white mb-2">Waiting for Admin</h1>
          <p className="text-gray-400 mb-8">Questions are being set up. Hang tight!</p>
          <button
            type="button"
            onClick={async () => {
              const supabase = createClient()
              await supabase.auth.signOut()
              router.push('/login')
            }}
            className="text-sm text-gray-500 hover:text-gray-300 border border-gray-700 hover:border-gray-500 px-4 py-2 rounded-lg transition-colors"
          >
            Logout
          </button>
        </div>
      </div>
    )
  }

  if (data.status === 'completed') {
    return (
      <div className="min-h-screen bg-brand-bg flex items-center justify-center p-4">
        <div className="text-center">
          <div className="text-8xl mb-6">🏆</div>
          <h1 className="text-4xl font-bold text-brand-gold mb-2">Hunt Complete!</h1>
          <p className="text-gray-400">Congratulations, {teamName}! You&apos;ve found all the clues.</p>
        </div>
      </div>
    )
  }

  if (!question) return null

  const optionValues = [question.option_a, question.option_b, question.option_c, question.option_d]

  return (
    <div className="min-h-screen bg-brand-bg">
      {frozen && <FreezeOverlay remainingMs={freezeMs} onExpired={handleFreezeExpired} />}

      <header className="border-b border-brand-blue/20 bg-brand-surface/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <span className="text-xs text-gray-500 uppercase tracking-widest">Team</span>
            <p className="text-white font-semibold">{teamName}</p>
          </div>
          <div className="text-center">
            <span className="text-xs text-gray-500 uppercase tracking-widest">Progress</span>
            <p className="text-brand-blue-light font-bold">
              Question {data.status === 'active' ? data.questionIndex : 1} <span className="text-gray-600">/ 10</span>
            </p>
          </div>
          <button
            type="button"
            onClick={async () => {
              const supabase = createClient()
              await supabase.auth.signOut()
              router.push('/login')
            }}
            className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
          >
            Logout
          </button>
        </div>
        <div className="max-w-3xl mx-auto px-4 pb-3">
          <div className="h-1 bg-brand-card rounded-full">
            <div
              className="h-1 bg-brand-blue rounded-full transition-all duration-500"
              style={{ width: `${data.status === 'active' ? ((data.questionIndex - 1) / 10) * 100 : 0}%` }}
            />
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8">
        {result ? (
          <div className="text-center">
            <div className="text-6xl mb-6">✅</div>
            <h2 className="text-2xl font-bold text-green-400 mb-2">Correct!</h2>
            <p className="text-gray-400 mb-8">Your next location clue:</p>
            <div className="p-8 bg-brand-surface border border-brand-gold/40 rounded-2xl shadow-[0_0_30px_rgba(245,158,11,0.15)] mb-8">
              <p className="text-2xl font-mono gold-text font-semibold leading-relaxed">
                {result.clue}
              </p>
            </div>
            {(data.status === 'active' && data.questionIndex < 10) ? (
              <button
                onClick={handleNextQuestion}
                className="px-8 py-3 bg-brand-blue hover:bg-blue-700 text-white font-semibold rounded-xl transition-all hover:shadow-[0_0_20px_rgba(59,130,246,0.4)]"
              >
                Next Question →
              </button>
            ) : (
              <button
                onClick={handleNextQuestion}
                className="px-8 py-3 bg-brand-gold hover:bg-amber-600 text-black font-semibold rounded-xl transition-all"
              >
                Finish Hunt 🏆
              </button>
            )}
          </div>
        ) : (
          <div>
            <div className="mb-8 p-8 bg-brand-surface border border-brand-blue/20 rounded-2xl card-glow">
              <p className="text-xs text-gray-500 uppercase tracking-widest mb-4">
                Question {data.status === 'active' ? data.questionIndex : ''} of 10
              </p>
              <p className="text-xl text-white leading-relaxed font-medium">
                {question.question_text}
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-8">
              {OPTIONS.map((opt, idx) => (
                <button
                  key={opt}
                  onClick={() => setSelectedOption(opt)}
                  disabled={isPending}
                  className={`p-4 rounded-xl border-2 text-left transition-all font-medium ${
                    selectedOption === opt
                      ? 'border-brand-blue bg-brand-blue/10 text-brand-blue-light shadow-[0_0_15px_rgba(59,130,246,0.3)]'
                      : 'border-brand-blue/20 bg-brand-surface text-gray-300 hover:border-brand-blue/50 hover:bg-brand-card'
                  }`}
                >
                  <span className="inline-block w-7 h-7 rounded-lg bg-brand-card text-xs font-bold text-center leading-7 mr-3 border border-brand-blue/30">
                    {LABELS[idx]}
                  </span>
                  {optionValues[idx]}
                </button>
              ))}
            </div>

            <button
              onClick={handleSubmit}
              disabled={!selectedOption || isPending}
              className="w-full py-4 bg-brand-blue hover:bg-blue-700 text-white font-bold rounded-xl transition-all disabled:opacity-40 disabled:cursor-not-allowed hover:shadow-[0_0_20px_rgba(59,130,246,0.4)] text-lg"
            >
              {isPending ? 'Checking...' : 'Submit Answer'}
            </button>

            <HintSection
              questionId={question.id}
              hintsUsed={data.status === 'active' ? data.hintsUsed : 0}
              providedHintNumbers={providedHints}
              hintTexts={[question.hint_1, question.hint_2, question.hint_3]}
            />
          </div>
        )}
      </main>
    </div>
  )
}
