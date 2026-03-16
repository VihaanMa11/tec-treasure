import { getAllTeamUsers, getTeamQuestions } from '@/app/actions/admin'
import QuestionsClient from './QuestionsClient'

export default async function QuestionsPage() {
  const teams = await getAllTeamUsers()
  return <QuestionsClient teams={teams} />
}
