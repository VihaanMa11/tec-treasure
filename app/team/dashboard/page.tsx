import { getCurrentQuestion } from '@/app/actions/team'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import TeamDashboardClient from './TeamDashboardClient'

export default async function TeamDashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const data = await getCurrentQuestion()

  return (
    <TeamDashboardClient
      initialData={data}
      teamName={user.user_metadata?.team_name ?? 'Team'}
      teamId={user.id}
    />
  )
}
