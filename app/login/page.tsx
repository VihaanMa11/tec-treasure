'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { data, error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError('Invalid credentials. Check your email and password.')
      setLoading(false)
      return
    }

    const role = data.user?.user_metadata?.role
    router.push(role === 'admin' ? '/admin' : '/team/dashboard')
    router.refresh()
  }

  return (
    <div className="min-h-screen bg-brand-bg flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo/Title */}
        <div className="text-center mb-8">
          <div className="inline-block p-3 rounded-xl bg-brand-blue/10 border border-brand-blue/30 mb-4">
            <span className="text-4xl">🔍</span>
          </div>
          <h1 className="text-4xl font-bold text-white tracking-tight">
            TEC <span className="text-brand-blue-light">Treasure</span> Hunt
          </h1>
          <p className="text-gray-400 mt-2 text-sm">Enter your credentials to begin the hunt</p>
        </div>

        {/* Login Card */}
        <div className="bg-brand-surface border border-brand-blue/20 rounded-2xl p-8 card-glow">
          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="block text-xs text-gray-400 uppercase tracking-widest mb-2">
                Team Email
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="team@example.com"
                required
                className="w-full px-4 py-3 bg-brand-card border border-brand-blue/20 rounded-xl text-white placeholder-gray-600 focus:outline-none focus:border-brand-blue transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs text-gray-400 uppercase tracking-widest mb-2">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full px-4 py-3 bg-brand-card border border-brand-blue/20 rounded-xl text-white placeholder-gray-600 focus:outline-none focus:border-brand-blue transition-colors"
              />
            </div>

            {error && (
              <div className="px-4 py-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-brand-blue hover:bg-blue-700 text-white font-semibold rounded-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-[0_0_20px_rgba(59,130,246,0.4)]"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Authenticating...
                </span>
              ) : (
                'Enter the Hunt →'
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
