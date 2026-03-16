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
  | { completed: true; question: null; questionIndex: null; hintsUsed: null }
  | { completed: false; question: Question; questionIndex: number; hintsUsed: number }

export async function getCurrentQuestion(): Promise<DashboardData> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const { data: progress } = await supabase
    .from('team_progress')
    .select('current_question_index, completed_at')
    .eq('team_id', user.id)
    .single()

  if (!progress || progress.completed_at) {
    return { completed: true, question: null, questionIndex: null, hintsUsed: null }
  }

  const { data: question } = await supabase
    .from('questions')
    .select('id, order_index, question_text, option_a, option_b, option_c, option_d, hint_1, hint_2, hint_3')
    .eq('team_id', user.id)
    .eq('order_index', progress.current_question_index)
    .single()

  if (!question) throw new Error('Question not found')

  const { count: hintsUsed } = await supabase
    .from('hint_requests')
    .select('*', { count: 'exact', head: true })
    .eq('team_id', user.id)
    .eq('question_id', question.id)

  return {
    completed: false,
    question: question as Question,
    questionIndex: progress.current_question_index,
    hintsUsed: hintsUsed ?? 0,
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
    const isLastQuestion = question.order_index === 10
    await adminSupabase
      .from('team_progress')
      .update(
        isLastQuestion
          ? { current_question_index: 11, completed_at: new Date().toISOString() }
          : { current_question_index: question.order_index + 1 }
      )
      .eq('team_id', user.id)

    return { correct: true, clue: question.location_clue }
  }

  return { correct: false, clue: null }
}

export async function requestHint(
  questionId: string,
  hintNumber: number
): Promise<{ success: boolean }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const adminSupabase = createAdminClient()

  // Validate sequential ordering
  const { count: existingCount } = await adminSupabase
    .from('hint_requests')
    .select('*', { count: 'exact', head: true })
    .eq('team_id', user.id)
    .eq('question_id', questionId)

  if (hintNumber !== (existingCount ?? 0) + 1) {
    throw new Error('Invalid hint number')
  }

  const { error } = await adminSupabase.from('hint_requests').insert({
    team_id: user.id,
    question_id: questionId,
    hint_number: hintNumber,
  })

  if (error && error.code !== '23505') throw error
  return { success: true }
}

export async function getProvidedHints(questionId: string): Promise<number[]> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data } = await supabase
    .from('hint_requests')
    .select('hint_number, provided_at')
    .eq('team_id', user.id)
    .eq('question_id', questionId)
    .not('provided_at', 'is', null)

  return (data ?? []).map((r: { hint_number: number }) => r.hint_number)
}
