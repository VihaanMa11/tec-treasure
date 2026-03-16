'use client'
import { useState, useEffect } from 'react'

interface FreezeOverlayProps {
  remainingMs: number
  onExpired: () => void
}

export default function FreezeOverlay({ remainingMs, onExpired }: FreezeOverlayProps) {
  const [ms, setMs] = useState(remainingMs)

  useEffect(() => {
    if (ms <= 0) { onExpired(); return }
    const interval = setInterval(() => {
      setMs(prev => {
        if (prev <= 1000) { onExpired(); return 0 }
        return prev - 1000
      })
    }, 1000)
    return () => clearInterval(interval)
  }, [ms, onExpired])

  const totalSeconds = Math.ceil(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60).toString().padStart(2, '0')
  const seconds = (totalSeconds % 60).toString().padStart(2, '0')

  return (
    <div className="fixed inset-0 z-50 bg-black/90 flex flex-col items-center justify-center animate-pulse-red">
      <div className="text-center p-12 rounded-3xl border-2 border-red-500 bg-brand-surface shadow-[0_0_60px_rgba(239,68,68,0.4)]">
        <div className="text-6xl mb-6">🔒</div>
        <h2 className="text-3xl font-bold text-red-400 mb-2">Incorrect Answer</h2>
        <p className="text-gray-400 mb-8">Please wait before trying again</p>
        <div className="text-7xl font-mono font-bold text-red-300 tracking-wider">
          {minutes}:{seconds}
        </div>
        <p className="text-gray-500 mt-4 text-sm">Screen unlocks automatically</p>
      </div>
    </div>
  )
}
