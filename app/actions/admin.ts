'use server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@/lib/supabase/admin'

async function verifyAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.user_metadata?.role !== 'admin') {
    throw new Error('Unauthorized')
  }
  return user
}

export type TeamProgress = {
  id: string
  teamName: string
  email: string
  currentIndex: number
  completedAt: string | null
}

export async function getAllTeamsProgress(): Promise<TeamProgress[]> {
  await verifyAdmin()
  const admin = createAdminClient()

  const { data: { users } } = await admin.auth.admin.listUsers()
  const { data: progress } = await admin
    .from('team_progress')
    .select('team_id, current_question_index, completed_at')

  return users
    .filter(u => u.user_metadata?.role === 'team')
    .map(u => ({
      id: u.id,
      teamName: u.user_metadata?.team_name ?? u.email ?? 'Unknown',
      email: u.email ?? '',
      currentIndex: progress?.find(p => p.team_id === u.id)?.current_question_index ?? 1,
      completedAt: progress?.find(p => p.team_id === u.id)?.completed_at ?? null,
    }))
    .sort((a, b) => a.teamName.localeCompare(b.teamName))
}

export type TeamQuestion = {
  id: string | null
  order_index: number
  question_text: string
  option_a: string; option_b: string; option_c: string; option_d: string
  correct_option: string
  location_clue: string
  hint_1: string; hint_2: string; hint_3: string
}

export async function getTeamQuestions(teamId: string): Promise<TeamQuestion[]> {
  await verifyAdmin()
  const admin = createAdminClient()

  const { data } = await admin
    .from('questions')
    .select('*')
    .eq('team_id', teamId)
    .order('order_index')

  return Array.from({ length: 10 }, (_, i) => {
    const existing = data?.find(q => q.order_index === i + 1)
    return existing ?? {
      id: null,
      order_index: i + 1,
      question_text: '', option_a: '', option_b: '', option_c: '', option_d: '',
      correct_option: 'a', location_clue: '',
      hint_1: '', hint_2: '', hint_3: '',
    }
  })
}

export async function upsertQuestion(data: {
  teamId: string; orderIndex: number
  questionText: string; optionA: string; optionB: string; optionC: string; optionD: string
  correctOption: string; locationClue: string
  hint1: string; hint2: string; hint3: string
}): Promise<void> {
  await verifyAdmin()
  const admin = createAdminClient()

  const { error } = await admin.from('questions').upsert(
    {
      team_id: data.teamId, order_index: data.orderIndex,
      question_text: data.questionText,
      option_a: data.optionA, option_b: data.optionB,
      option_c: data.optionC, option_d: data.optionD,
      correct_option: data.correctOption, location_clue: data.locationClue,
      hint_1: data.hint1, hint_2: data.hint2, hint_3: data.hint3,
    },
    { onConflict: 'team_id,order_index' }
  )
  if (error) throw error
}

export type HintRequest = {
  id: string
  teamId: string
  teamName: string
  questionId: string
  questionIndex: number
  hintNumber: number
  requestedAt: string
}

export async function getPendingHints(): Promise<HintRequest[]> {
  await verifyAdmin()
  const admin = createAdminClient()

  const { data: hints } = await admin
    .from('hint_requests')
    .select('id, team_id, question_id, hint_number, requested_at')
    .is('provided_at', null)
    .order('requested_at', { ascending: true })

  if (!hints || hints.length === 0) return []

  const { data: { users } } = await admin.auth.admin.listUsers()
  const { data: questions } = await admin
    .from('questions')
    .select('id, order_index')

  return hints.map(h => {
    const user = users.find(u => u.id === h.team_id)
    const question = questions?.find(q => q.id === h.question_id)
    return {
      id: h.id,
      teamId: h.team_id,
      teamName: user?.user_metadata?.team_name ?? 'Unknown',
      questionId: h.question_id,
      questionIndex: question?.order_index ?? 0,
      hintNumber: h.hint_number,
      requestedAt: h.requested_at,
    }
  })
}

export async function markHintProvided(hintRequestId: string): Promise<void> {
  await verifyAdmin()
  const admin = createAdminClient()
  await admin
    .from('hint_requests')
    .update({ provided_at: new Date().toISOString() })
    .eq('id', hintRequestId)
}

export async function resetTeamProgress(teamId: string): Promise<void> {
  await verifyAdmin()
  const admin = createAdminClient()
  await admin.from('attempts').delete().eq('team_id', teamId)
  await admin.from('hint_requests').delete().eq('team_id', teamId)
  await admin
    .from('team_progress')
    .update({ current_question_index: 1, completed_at: null })
    .eq('team_id', teamId)
}

export async function getAllTeamUsers() {
  await verifyAdmin()
  const admin = createAdminClient()
  const { data: { users } } = await admin.auth.admin.listUsers()
  return users
    .filter(u => u.user_metadata?.role === 'team')
    .map(u => ({ id: u.id, email: u.email ?? '', teamName: u.user_metadata?.team_name ?? '' }))
    .sort((a, b) => a.teamName.localeCompare(b.teamName))
}
