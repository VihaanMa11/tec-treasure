'use client'
import { useState, useTransition } from 'react'
import { getTeamQuestions, upsertQuestion, type TeamQuestion } from '@/app/actions/admin'

interface Team { id: string; email: string; teamName: string }

export default function QuestionsClient({ teams }: { teams: Team[] }) {
  const [selectedTeamId, setSelectedTeamId] = useState<string>(teams[0]?.id ?? '')
  const [questions, setQuestions] = useState<TeamQuestion[]>([])
  const [loaded, setLoaded] = useState(false)
  const [editing, setEditing] = useState<number | null>(null)
  const [form, setForm] = useState<Partial<TeamQuestion>>({})
  const [isLoading, startLoadTransition] = useTransition()
  const [isSaving, startSaveTransition] = useTransition()
  const [saved, setSaved] = useState<number | null>(null)

  function loadTeam(teamId: string) {
    setSelectedTeamId(teamId)
    setLoaded(false)
    setEditing(null)
    startLoadTransition(async () => {
      const qs = await getTeamQuestions(teamId)
      setQuestions(qs)
      setLoaded(true)
    })
  }

  function startEdit(q: TeamQuestion) {
    setEditing(q.order_index)
    setForm({ ...q })
  }

  function saveQuestion() {
    if (!form || editing === null) return
    startSaveTransition(async () => {
      await upsertQuestion({
        teamId: selectedTeamId,
        orderIndex: editing,
        questionText: form.question_text ?? '',
        optionA: form.option_a ?? '', optionB: form.option_b ?? '',
        optionC: form.option_c ?? '', optionD: form.option_d ?? '',
        correctOption: form.correct_option ?? 'a',
        locationClue: form.location_clue ?? '',
        hint1: form.hint_1 ?? '', hint2: form.hint_2 ?? '', hint3: form.hint_3 ?? '',
        unlockPassword: form.unlock_password ?? '',
      })
      const updated = await getTeamQuestions(selectedTeamId)
      setQuestions(updated)
      setEditing(null)
      setSaved(editing)
      setTimeout(() => setSaved(null), 2000)
    })
  }

  function field(key: keyof TeamQuestion, label: string, multiline = false) {
    return (
      <div>
        <label className="block text-xs text-gray-500 mb-1">{label}</label>
        {multiline ? (
          <textarea
            value={(form[key] as string) ?? ''}
            onChange={e => setForm(prev => ({ ...prev, [key]: e.target.value }))}
            rows={2}
            className="w-full px-3 py-2 bg-brand-bg border border-brand-blue/20 rounded-lg text-white text-sm focus:outline-none focus:border-brand-blue resize-none"
          />
        ) : (
          <input
            value={(form[key] as string) ?? ''}
            onChange={e => setForm(prev => ({ ...prev, [key]: e.target.value }))}
            className="w-full px-3 py-2 bg-brand-bg border border-brand-blue/20 rounded-lg text-white text-sm focus:outline-none focus:border-brand-blue"
          />
        )}
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center gap-4 mb-8">
        <h2 className="text-2xl font-bold text-white">Question Management</h2>
        <select
          value={selectedTeamId}
          onChange={e => loadTeam(e.target.value)}
          className="px-4 py-2 bg-brand-surface border border-brand-blue/20 rounded-xl text-white text-sm focus:outline-none focus:border-brand-blue"
        >
          <option value="">Select team...</option>
          {teams.map(t => (
            <option key={t.id} value={t.id}>{t.teamName}</option>
          ))}
        </select>
        {!loaded && selectedTeamId && (
          <button
            onClick={() => loadTeam(selectedTeamId)}
            disabled={isLoading}
            className="px-4 py-2 bg-brand-blue hover:bg-blue-700 text-white text-sm rounded-xl transition-colors"
          >
            {isLoading ? 'Loading...' : 'Load Questions'}
          </button>
        )}
      </div>

      {loaded && (
        <div className="space-y-3">
          {questions.map(q => (
            <div
              key={q.order_index}
              className={`p-5 rounded-xl border transition-all ${
                editing === q.order_index
                  ? 'border-brand-blue/60 bg-brand-surface'
                  : saved === q.order_index
                  ? 'border-green-500/40 bg-green-500/5'
                  : 'border-brand-blue/20 bg-brand-surface hover:border-brand-blue/40'
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-semibold text-brand-blue-light">
                  Question {q.order_index}
                </span>
                {saved === q.order_index && (
                  <span className="text-xs text-green-400">✓ Saved</span>
                )}
                {editing !== q.order_index && (
                  <button
                    onClick={() => startEdit(q)}
                    className="text-xs text-gray-500 hover:text-white px-3 py-1 border border-gray-700 rounded-lg transition-colors"
                  >
                    Edit
                  </button>
                )}
              </div>

              {editing === q.order_index ? (
                <div className="space-y-3">
                  {field('question_text', 'Question Text', true)}
                  <div className="grid grid-cols-2 gap-3">
                    {field('option_a', 'Option A')}
                    {field('option_b', 'Option B')}
                    {field('option_c', 'Option C')}
                    {field('option_d', 'Option D')}
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Correct Answer</label>
                    <select
                      value={form.correct_option ?? 'a'}
                      onChange={e => setForm(prev => ({ ...prev, correct_option: e.target.value }))}
                      className="px-3 py-2 bg-brand-bg border border-brand-blue/20 rounded-lg text-white text-sm focus:outline-none"
                    >
                      <option value="a">A</option>
                      <option value="b">B</option>
                      <option value="c">C</option>
                      <option value="d">D</option>
                    </select>
                  </div>
                  {field('location_clue', 'Location Clue (shown on correct answer)', true)}
                  <div className="grid grid-cols-3 gap-3">
                    {field('hint_1', 'Hint 1')}
                    {field('hint_2', 'Hint 2')}
                    {field('hint_3', 'Hint 3')}
                  </div>
                  {/* Unlock Password — only for Q2+ */}
                  {editing >= 2 ? (
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">
                        Unlock Password (teams enter this to access question {editing})
                      </label>
                      <input
                        value={(form.unlock_password as string) ?? ''}
                        onChange={e => setForm(prev => ({ ...prev, unlock_password: e.target.value }))}
                        placeholder="e.g. TREASURE2025"
                        className="w-full px-3 py-2 bg-brand-bg border border-brand-gold/30 rounded-lg text-white text-sm focus:outline-none focus:border-brand-gold"
                      />
                    </div>
                  ) : (
                    <p className="text-xs text-gray-600 italic">No unlock password required for Question 1.</p>
                  )}
                  <div className="flex gap-3 pt-2">
                    <button
                      onClick={saveQuestion}
                      disabled={isSaving}
                      className="px-5 py-2 bg-brand-blue hover:bg-blue-700 text-white text-sm rounded-xl transition-colors disabled:opacity-50"
                    >
                      {isSaving ? 'Saving...' : 'Save Question'}
                    </button>
                    <button
                      onClick={() => setEditing(null)}
                      className="px-5 py-2 border border-gray-700 text-gray-400 hover:text-white text-sm rounded-xl transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-1">
                  <p className="text-sm text-gray-400 truncate">
                    {q.question_text || <span className="italic text-gray-600">Not set yet</span>}
                  </p>
                  {q.order_index >= 2 && q.unlock_password && (
                    <p className="text-xs text-brand-gold/60">🔐 Password: {q.unlock_password}</p>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
