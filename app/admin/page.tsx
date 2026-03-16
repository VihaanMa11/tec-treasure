import { getAllTeamsProgress } from '@/app/actions/admin'
import AdminOverviewClient from './AdminOverviewClient'

export default async function AdminPage() {
  const teams = await getAllTeamsProgress()
  return <AdminOverviewClient initialTeams={teams} />
}
