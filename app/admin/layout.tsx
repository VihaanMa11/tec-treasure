import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import LogoutButton from './LogoutButton'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.user_metadata?.role !== 'admin') redirect('/login')

  return (
    <div className="min-h-screen bg-brand-bg">
      <header className="border-b border-brand-blue/20 bg-brand-surface sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-xl font-bold text-white">
            🔍 <span className="text-brand-blue-light">Admin</span> Control Panel
          </h1>
          <nav className="flex gap-1">
            {[
              { href: '/admin', label: 'Overview' },
              { href: '/admin/questions', label: 'Questions' },
              { href: '/admin/teams', label: 'Teams' },
            ].map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                className="px-4 py-2 rounded-lg text-sm text-gray-400 hover:text-white hover:bg-brand-card transition-colors"
              >
                {label}
              </Link>
            ))}
          </nav>
          <LogoutButton />
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-4 py-8">{children}</main>
    </div>
  )
}
