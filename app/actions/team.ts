'use server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@/lib/supabase/admin'

export type Question = {
  id: string
  order_index: number
  question_text: string
  option_a: string
  option_b: string
  option_c: string
  option_d: string
  hint_1: string
  hint_2: string
  hint_3: string
}

export type DashboardData =
  | { status: 'waiting' }
  | { status: 'completed'; startedAt: string; completedAt: string }
  | { status: 'active'; question: Question; questionIndex: number; startedAt: string }

// Legacy aliases so existing client code keeps compiling
export type DashboardDataLegacy = DashboardData & { completed?: boolean; question?: Question | null; questionIndex?: number | null; hintsUsed?: number | null }

export async function getCurrentQuestion(): Promise<DashboardData> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const { data: progress } = await supabase
    .from('team_progress')
    .select('current_question_index, completed_at, started_at')
    .eq('team_id', user.id)
    .single()

  if (!progress) return { status: 'waiting' }
  if (progress.completed_at) return {
    status: 'completed',
    startedAt: progress.started_at ?? new Date().toISOString(),
    completedAt: progress.completed_at,
  }

  const { data: question } = await supabase
    .from('questions')
    .select('id, order_index, question_text, option_a, option_b, option_c, option_d, hint_1, hint_2, hint_3')
    .eq('team_id', user.id)
    .eq('order_index', progress.current_question_index)
    .single()

  if (!question) return { status: 'waiting' }

  return {
    status: 'active',
    question: question as Question,
    questionIndex: progress.current_question_index,
    startedAt: progress.started_at ?? new Date().toISOString(),
  }
}

export async function submitAnswer(
  questionId: string,
  selectedOption: string
): Promise<{ correct: boolean; clue: string | null }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const adminSupabase = createAdminClient()

  const { data: question } = await adminSupabase
    .from('questions')
    .select('correct_option, location_clue, team_id, order_index')
    .eq('id', questionId)
    .single()

  if (!question || question.team_id !== user.id) throw new Error('Invalid question')

  // Guard against replaying old question submissions
  const { data: progress } = await adminSupabase
    .from('team_progress')
    .select('current_question_index')
    .eq('team_id', user.id)
    .single()

  if (!progress || progress.current_question_index !== question.order_index) {
    throw new Error('Question is not current')
  }

  const isCorrect = question.correct_option === selectedOption

  await adminSupabase.from('attempts').insert({
    team_id: user.id,
    question_id: questionId,
    selected_option: selectedOption,
    is_correct: isCorrect,
  })

  if (isCorrect) {
    const isLastQuestion = question.order_index === 5
    await adminSupabase
      .from('team_progress')
      .update(
        isLastQuestion
          ? { current_question_index: 6, completed_at: new Date().toISOString() }
          : { current_question_index: question.order_index + 1 }
      )
      .eq('team_id', user.id)

    return { correct: true, clue: question.location_clue }
  }

  return { correct: false, clue: null }
}

export async function unlockQuestion(
  password: string
): Promise<{ success: boolean }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const adminSupabase = createAdminClient()

  const { data: progress } = await adminSupabase
    .from('team_progress')
    .select('current_question_index')
    .eq('team_id', user.id)
    .single()

  if (!progress) throw new Error('No progress found')

  // Look up the current question by index (not by ID) so Q2+ unlock works
  // after submitAnswer has already advanced current_question_index
  const { data: question } = await adminSupabase
    .from('questions')
    .select('unlock_password')
    .eq('team_id', user.id)
    .eq('order_index', progress.current_question_index)
    .single()

  if (!question) throw new Error('Question not found')

  return { success: question.unlock_password === password }
}
