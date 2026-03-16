import { getAllTeamsProgress } from '@/app/actions/admin'
import TeamsClient from './TeamsClient'

export default async function TeamsPage() {
  const teams = await getAllTeamsProgress()
  return <TeamsClient initialTeams={teams} />
}
