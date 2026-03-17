'use client'
import { useState, useTransition, useRef, useEffect } from 'react'
import { unlockQuestion } from '@/app/actions/team'

interface Props {
  questionId: string
  onSuccess: () => void
}

export default function UnlockModal({ questionId, onSuccess }: Props) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState(false)
  const [shake, setShake] = useState(false)
  const [isPending, startTransition] = useTransition()
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  function handleSubmit() {
    if (!password.trim() || isPending) return
    setError(false)
    startTransition(async () => {
      const res = await unlockQuestion(questionId, password.trim())
      if (res.success) {
        onSuccess()
      } else {
        setPassword('')
        setError(true)
        setShake(true)
        setTimeout(() => setShake(false), 500)
      }
    })
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') handleSubmit()
  }

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className={`bg-brand-surface border border-brand-blue/40 rounded-2xl p-8 w-full max-w-sm shadow-[0_0_40px_rgba(59,130,246,0.2)] ${shake ? 'animate-shake' : ''}`}>
        <div className="text-4xl text-center mb-4">🔐</div>
        <h2 className="text-xl font-bold text-white text-center mb-2">Enter Password</h2>
        <p className="text-gray-400 text-sm text-center mb-6">
          Enter the password found at your last location to unlock the next question.
        </p>
        <input
          ref={inputRef}
          type="text"
          value={password}
          onChange={e => setPassword(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Password..."
          className={`w-full px-4 py-3 bg-brand-bg border rounded-xl text-white text-center text-lg tracking-widest focus:outline-none mb-3 ${
            error
              ? 'border-red-500/60 focus:border-red-500'
              : 'border-brand-blue/20 focus:border-brand-blue'
          }`}
        />
        {error && (
          <p className="text-red-400 text-sm text-center mb-3">Wrong password. Try again.</p>
        )}
        <button
          onClick={handleSubmit}
          disabled={!password.trim() || isPending}
          className="w-full py-3 bg-brand-blue hover:bg-blue-700 text-white font-bold rounded-xl transition-all disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {isPending ? 'Checking...' : 'Unlock →'}
        </button>
      </div>
    </div>
  )
}
