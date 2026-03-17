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

  const progressMap = new Map((progress ?? []).map(p => [p.team_id, p]))

  return users
    .filter(u => u.user_metadata?.role === 'team')
    .map(u => {
      const prog = progressMap.get(u.id)
      return {
        id: u.id,
        teamName: u.user_metadata?.team_name ?? u.email ?? 'Unknown',
        email: u.email ?? '',
        currentIndex: prog?.current_question_index ?? 1,
        completedAt: prog?.completed_at ?? null,
      }
    })
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
  unlock_password: string
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
      unlock_password: '',
    }
  })
}

export async function upsertQuestion(data: {
  teamId: string; orderIndex: number
  questionText: string; optionA: string; optionB: string; optionC: string; optionD: string
  correctOption: string; locationClue: string
  hint1: string; hint2: string; hint3: string
  unlockPassword: string
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
      unlock_password: data.unlockPassword,
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
  const { error } = await admin
    .from('hint_requests')
    .update({ provided_at: new Date().toISOString() })
    .eq('id', hintRequestId)
  if (error) throw error
}

export async function resetTeamProgress(teamId: string): Promise<void> {
  await verifyAdmin()
  const admin = createAdminClient()

  // Validate that teamId belongs to a team-role user
  const { data: { user: targetUser } } = await admin.auth.admin.getUserById(teamId)
  if (!targetUser || targetUser.user_metadata?.role !== 'team') {
    throw new Error('Target user is not a team')
  }

  const { error: attemptsError } = await admin.from('attempts').delete().eq('team_id', teamId)
  if (attemptsError) throw attemptsError

  const { error: hintsError } = await admin.from('hint_requests').delete().eq('team_id', teamId)
  if (hintsError) throw hintsError

  const { error: progressError } = await admin
    .from('team_progress')
    .update({ current_question_index: 1, completed_at: null })
    .eq('team_id', teamId)
  if (progressError) throw progressError
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

export async function startAllTeams(): Promise<void> {
  await verifyAdmin()
  const admin = createAdminClient()
  const { data: { users } } = await admin.auth.admin.listUsers()
  const teamUsers = users.filter(u => u.user_metadata?.role === 'team')

  const rows = teamUsers.map(u => ({
    team_id: u.id,
    current_question_index: 1,
    completed_at: null,
  }))

  const { error } = await admin
    .from('team_progress')
    .upsert(rows, { onConflict: 'team_id' })
  if (error) throw error
}

export type FrozenTeam = {
  teamId: string
  teamName: string
  questionId: string
  questionIndex: number
  frozenSince: string // ISO timestamp of wrong attempt
}

export async function getFrozenTeams(): Promise<FrozenTeam[]> {
  await verifyAdmin()
  const admin = createAdminClient()
  const cutoff = new Date(Date.now() - 15 * 60 * 1000).toISOString()

  const [
    { data: wrongAttempts },
    { data: overrides },
    { data: progress },
    { data: questions },
    { data: { users } },
  ] = await Promise.all([
    admin.from('attempts').select('team_id, question_id, attempted_at')
      .eq('is_correct', false).gte('attempted_at', cutoff)
      .order('attempted_at', { ascending: false }),
    admin.from('freeze_overrides').select('team_id, question_id, overridden_at')
      .gte('overridden_at', cutoff),
    admin.from('team_progress').select('team_id, current_question_index'),
    admin.from('questions').select('id, order_index'),
    admin.auth.admin.listUsers(),
  ])

  if (!wrongAttempts || wrongAttempts.length === 0) return []

  const frozenMap = new Map<string, FrozenTeam>()
  for (const attempt of wrongAttempts) {
    if (frozenMap.has(attempt.team_id)) continue
    const teamProgress = progress?.find(p => p.team_id === attempt.team_id)
    const question = questions?.find(q => q.id === attempt.question_id)
    if (!teamProgress || !question) continue
    if (question.order_index !== teamProgress.current_question_index) continue
    const override = overrides?.find(
      o => o.team_id === attempt.team_id &&
           o.question_id === attempt.question_id &&
           new Date(o.overridden_at) > new Date(attempt.attempted_at)
    )
    if (override) continue
    const user = users.find(u => u.id === attempt.team_id)
    frozenMap.set(attempt.team_id, {
      teamId: attempt.team_id,
      teamName: user?.user_metadata?.team_name ?? 'Unknown',
      questionId: attempt.question_id,
      questionIndex: question.order_index,
      frozenSince: attempt.attempted_at,
    })
  }
  return Array.from(frozenMap.values())
}

export async function revokeFreeze(teamId: string, questionId: string): Promise<void> {
  await verifyAdmin()
  const admin = createAdminClient()
  const { error } = await admin.from('freeze_overrides').insert({ team_id: teamId, question_id: questionId })
  if (error) throw error
}
