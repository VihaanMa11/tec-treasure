import { getAllTeamsProgress, isHuntRunning } from '@/app/actions/admin'
import AdminOverviewClient from './AdminOverviewClient'

export default async function AdminPage() {
  const [teams, huntRunning] = await Promise.all([getAllTeamsProgress(), isHuntRunning()])
  return <AdminOverviewClient initialTeams={teams} initialHuntRunning={huntRunning} />
}
