'use client'
import { useState, useTransition } from 'react'
import { requestHint } from '@/app/actions/team'

interface HintSectionProps {
  questionId: string
  hintsUsed: number
  providedHintNumbers: number[]
  hintTexts: (string | null)[]
}

export default function HintSection({
  questionId, hintsUsed, providedHintNumbers, hintTexts
}: HintSectionProps) {
  const [localHintsUsed, setLocalHintsUsed] = useState(hintsUsed)
  const [requesting, startTransition] = useTransition()

  function handleRequestHint() {
    if (localHintsUsed >= 3) return
    const nextHint = localHintsUsed + 1
    startTransition(async () => {
      await requestHint(questionId, nextHint)
      setLocalHintsUsed(nextHint)
    })
  }

  return (
    <div className="mt-6 p-5 bg-brand-card border border-brand-gold/20 rounded-xl">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs text-gray-400 uppercase tracking-widest">Hints</span>
        <div className="flex gap-1">
          {[1, 2, 3].map(n => (
            <div
              key={n}
              className={`w-6 h-6 rounded-full border-2 transition-colors ${
                n <= localHintsUsed
                  ? 'bg-brand-gold border-brand-gold'
                  : 'bg-transparent border-gray-600'
              }`}
            />
          ))}
        </div>
      </div>

      {providedHintNumbers.map(num => (
        <div key={num} className="mb-2 px-4 py-3 bg-brand-gold/10 border border-brand-gold/30 rounded-lg">
          <span className="text-xs text-brand-gold uppercase tracking-wider">Hint {num}: </span>
          <span className="text-gray-200 text-sm">{hintTexts[num - 1]}</span>
        </div>
      ))}

      {localHintsUsed < 3 && (
        <button
          onClick={handleRequestHint}
          disabled={requesting}
          className="w-full py-2 mt-2 border border-brand-gold/40 text-brand-gold hover:bg-brand-gold/10 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
        >
          {requesting ? 'Requesting...' : `Request Hint ${localHintsUsed + 1} / 3`}
        </button>
      )}

      {localHintsUsed > 0 && !providedHintNumbers.includes(localHintsUsed) && (
        <p className="text-center text-gray-500 text-xs mt-2">
          Hint requested — waiting for admin to provide it...
        </p>
      )}

      {localHintsUsed >= 3 && providedHintNumbers.length < 3 && (
        <p className="text-center text-gray-500 text-xs mt-2">All hints requested</p>
      )}
    </div>
  )
}
