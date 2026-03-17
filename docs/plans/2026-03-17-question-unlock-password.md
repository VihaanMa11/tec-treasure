# Question Unlock Password Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Gate questions 2–10 behind a password the admin sets; team is prompted when clicking "Next Question" after a correct answer, and the password is validated server-side.

**Architecture:** Add `unlock_password` column to `questions` table. New `unlockQuestion` server action uses the admin client to compare without exposing the password to the browser. A modal component intercepts the "Next Question" click for Q2–Q10. Admin questions editor gains an "Unlock Password" field for Q2–Q10.

**Tech Stack:** Next.js 15 App Router, TypeScript, Tailwind CSS, Supabase (service role for password comparison)

---

### Task 1: Database migration — add `unlock_password` column

**Files:**
- Create: `supabase/add_unlock_password.sql`

**Step 1: Create the migration file**

```sql
-- supabase/add_unlock_password.sql
ALTER TABLE public.questions
  ADD COLUMN IF NOT EXISTS unlock_password text NOT NULL DEFAULT '';
```

**Step 2: Run the SQL in Supabase Dashboard**

Go to Supabase Dashboard → SQL Editor → paste and run the file contents.
Expected: `ALTER TABLE` success message, no errors.

**Step 3: Verify**

In Supabase Table Editor → `questions` table, confirm `unlock_password` column exists with default `''`.

**Step 4: Commit**

```bash
git add supabase/add_unlock_password.sql
git commit -m "feat: add unlock_password column to questions table"
```

---

### Task 2: Server action — `unlockQuestion`

**Files:**
- Modify: `app/actions/team.ts`

**Step 1: Add the action at the bottom of the file**

Add this function to `app/actions/team.ts` (after the existing `getProvidedHints` function):

```typescript
export async function unlockQuestion(
  questionId: string,
  password: string
): Promise<{ success: boolean }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const adminSupabase = createAdminClient()
  const { data: question } = await adminSupabase
    .from('questions')
    .select('unlock_password, team_id, order_index')
    .eq('id', questionId)
    .single()

  if (!question || question.team_id !== user.id) throw new Error('Invalid question')
  // Q1 never has a gate — always allow
  if (question.order_index === 1) return { success: true }

  return { success: question.unlock_password === password }
}
```

**Step 2: Verify TypeScript compiles**

```bash
cd c:/Users/vihaa/Desktop/tec_tresure
npx tsc --noEmit
```
Expected: No errors.

**Step 3: Commit**

```bash
git add app/actions/team.ts
git commit -m "feat: add unlockQuestion server action"
```

---

### Task 3: UnlockModal component

**Files:**
- Create: `app/team/dashboard/UnlockModal.tsx`

**Step 1: Create the component**

```typescript
// app/team/dashboard/UnlockModal.tsx
'use client'
import { useState, useTransition, useRef, useEffect } from 'react'
import { unlockQuestion } from '@/app/actions/team'

interface Props {
  questionId: string
  onSuccess: () => void
}

export default function UnlockModal({ questionId, onSuccess }: Props) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState(false)
  const [shake, setShake] = useState(false)
  const [isPending, startTransition] = useTransition()
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  function handleSubmit() {
    if (!password.trim() || isPending) return
    setError(false)
    startTransition(async () => {
      const res = await unlockQuestion(questionId, password.trim())
      if (res.success) {
        onSuccess()
      } else {
        setPassword('')
        setError(true)
        setShake(true)
        setTimeout(() => setShake(false), 500)
      }
    })
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') handleSubmit()
  }

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className={`bg-brand-surface border border-brand-blue/40 rounded-2xl p-8 w-full max-w-sm shadow-[0_0_40px_rgba(59,130,246,0.2)] ${shake ? 'animate-shake' : ''}`}>
        <div className="text-4xl text-center mb-4">🔐</div>
        <h2 className="text-xl font-bold text-white text-center mb-2">Enter Password</h2>
        <p className="text-gray-400 text-sm text-center mb-6">
          Enter the password found at your last location to unlock the next question.
        </p>
        <input
          ref={inputRef}
          type="text"
          value={password}
          onChange={e => setPassword(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Password..."
          className={`w-full px-4 py-3 bg-brand-bg border rounded-xl text-white text-center text-lg tracking-widest focus:outline-none mb-3 ${
            error
              ? 'border-red-500/60 focus:border-red-500'
              : 'border-brand-blue/20 focus:border-brand-blue'
          }`}
        />
        {error && (
          <p className="text-red-400 text-sm text-center mb-3">Wrong password. Try again.</p>
        )}
        <button
          onClick={handleSubmit}
          disabled={!password.trim() || isPending}
          className="w-full py-3 bg-brand-blue hover:bg-blue-700 text-white font-bold rounded-xl transition-all disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {isPending ? 'Checking...' : 'Unlock →'}
        </button>
      </div>
    </div>
  )
}
```

**Step 2: Add `animate-shake` keyframes to Tailwind config**

Open `tailwind.config.ts` and add the shake animation:

```typescript
// In the theme.extend section:
keyframes: {
  shake: {
    '0%, 100%': { transform: 'translateX(0)' },
    '20%, 60%': { transform: 'translateX(-8px)' },
    '40%, 80%': { transform: 'translateX(8px)' },
  },
},
animation: {
  shake: 'shake 0.5s ease-in-out',
},
```

**Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```
Expected: No errors.

**Step 4: Commit**

```bash
git add app/team/dashboard/UnlockModal.tsx tailwind.config.ts
git commit -m "feat: add UnlockModal component for question password gate"
```

---

### Task 4: Wire UnlockModal into TeamDashboardClient

**Files:**
- Modify: `app/team/dashboard/TeamDashboardClient.tsx`

**Step 1: Add import at the top**

After the existing imports, add:
```typescript
import UnlockModal from './UnlockModal'
```

**Step 2: Add `showUnlock` state**

In the component, alongside existing state declarations, add:
```typescript
const [showUnlock, setShowUnlock] = useState(false)
```

**Step 3: Modify `handleNextQuestion`**

Replace the existing `handleNextQuestion` function:

```typescript
function handleNextQuestion() {
  // Q1 → Q2 and beyond need a password; Q1 itself has no gate
  const nextIndex = data.status === 'active' ? data.questionIndex + 1 : 2
  if (nextIndex > 1 && data.status === 'active' && data.questionIndex < 10) {
    // About to move to Q2+, require password
    setShowUnlock(true)
  } else {
    // Last question (Finish Hunt) or Q1 — no password needed
    setResult(null)
    setSelectedOption(null)
    router.refresh()
  }
}
```

**Step 4: Add `handleUnlockSuccess` handler**

```typescript
function handleUnlockSuccess() {
  setShowUnlock(false)
  setResult(null)
  setSelectedOption(null)
  router.refresh()
}
```

**Step 5: Render UnlockModal**

Inside the JSX return, just before `<header>`, add the modal (it renders as a fixed overlay so position doesn't matter structurally):

```tsx
{showUnlock && question && (
  <UnlockModal
    questionId={question.id}
    onSuccess={handleUnlockSuccess}
  />
)}
```

**Step 6: Fix "Finish Hunt" button**

The "Finish Hunt" button (last question) should NOT show the unlock modal. The logic in Step 3 already handles this: only shows unlock when `data.questionIndex < 10`. The "Finish Hunt" button path calls `handleNextQuestion` when `questionIndex === 10`, which skips the modal.

**Step 7: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```
Expected: No errors.

**Step 8: Commit**

```bash
git add app/team/dashboard/TeamDashboardClient.tsx
git commit -m "feat: show UnlockModal before advancing to Q2+ in team dashboard"
```

---

### Task 5: Admin questions editor — add Unlock Password field

**Files:**
- Modify: `app/admin/questions/QuestionsClient.tsx`
- Modify: `app/actions/admin.ts`

**Step 1: Update `TeamQuestion` type in `app/actions/admin.ts`**

Add `unlock_password` to the `TeamQuestion` type:

```typescript
export type TeamQuestion = {
  id: string | null
  order_index: number
  question_text: string
  option_a: string; option_b: string; option_c: string; option_d: string
  correct_option: string
  location_clue: string
  hint_1: string; hint_2: string; hint_3: string
  unlock_password: string   // ← add this line
}
```

**Step 2: Update `getTeamQuestions` fallback object in `app/actions/admin.ts`**

In the `getTeamQuestions` function, add `unlock_password: ''` to the fallback object:

```typescript
return existing ?? {
  id: null,
  order_index: i + 1,
  question_text: '', option_a: '', option_b: '', option_c: '', option_d: '',
  correct_option: 'a', location_clue: '',
  hint_1: '', hint_2: '', hint_3: '',
  unlock_password: '',   // ← add this line
}
```

**Step 3: Update `upsertQuestion` in `app/actions/admin.ts`**

Add `unlockPassword` to the data parameter and upsert call:

```typescript
export async function upsertQuestion(data: {
  teamId: string; orderIndex: number
  questionText: string; optionA: string; optionB: string; optionC: string; optionD: string
  correctOption: string; locationClue: string
  hint1: string; hint2: string; hint3: string
  unlockPassword: string   // ← add this line
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
      unlock_password: data.unlockPassword,   // ← add this line
    },
    { onConflict: 'team_id,order_index' }
  )
  if (error) throw error
}
```

**Step 4: Update `QuestionsClient.tsx` — add field to form**

In the `saveQuestion` function, add `unlockPassword` to the `upsertQuestion` call:

```typescript
await upsertQuestion({
  teamId: selectedTeamId,
  orderIndex: editing,
  questionText: form.question_text ?? '',
  optionA: form.option_a ?? '', optionB: form.option_b ?? '',
  optionC: form.option_c ?? '', optionD: form.option_d ?? '',
  correctOption: form.correct_option ?? 'a',
  locationClue: form.location_clue ?? '',
  hint1: form.hint_1 ?? '', hint2: form.hint_2 ?? '', hint3: form.hint_3 ?? '',
  unlockPassword: form.unlock_password ?? '',   // ← add this line
})
```

**Step 5: Add the "Unlock Password" field in the editor JSX**

In `QuestionsClient.tsx`, inside the editing form (after the hints grid, before the save/cancel buttons), add:

```tsx
{/* Unlock Password — only for Q2+ */}
{editing >= 2 ? (
  <div>
    <label className="block text-xs text-gray-500 mb-1">Unlock Password (teams enter this to access question {editing})</label>
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
```

**Step 6: Also show the password in collapsed (non-editing) view for Q2+**

In the collapsed view section (the `<p className="text-sm text-gray-400 truncate">` block), replace with:

```tsx
<div className="space-y-1">
  <p className="text-sm text-gray-400 truncate">
    {q.question_text || <span className="italic text-gray-600">Not set yet</span>}
  </p>
  {q.order_index >= 2 && q.unlock_password && (
    <p className="text-xs text-brand-gold/60">🔐 Password: {q.unlock_password}</p>
  )}
</div>
```

**Step 7: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```
Expected: No errors.

**Step 8: Commit**

```bash
git add app/actions/admin.ts app/admin/questions/QuestionsClient.tsx
git commit -m "feat: add unlock password field to admin question editor"
```

---

### Task 6: Manual end-to-end test

**Step 1: Start dev server**

```bash
npm run dev
```

**Step 2: Admin — set a password**

1. Log in as `admin@tech` / `admin@123`
2. Go to Questions tab → select Team 1 → Load Questions
3. Edit Question 2 → set "Unlock Password" to `TEST123` → Save

**Step 3: Team — verify password gate**

1. Open incognito → log in as `team1@tech` / `tech@123`
2. Answer Question 1 correctly
3. Click "Next Question" → UnlockModal should appear
4. Type wrong password → should shake and show "Wrong password"
5. Type `TEST123` → should dismiss and load Question 2

**Step 4: Verify Q1 has no gate**

Reset Team 1 progress from admin → Teams tab. Answer Q1. "Next Question" should open modal (because Q2 has a password set).

**Step 5: Verify Finish Hunt has no gate**

This requires completing Q1–Q9. Skippable for now; the logic skips the modal when `questionIndex === 10`.

**Step 6: Build check**

```bash
npm run build
```
Expected: Build succeeds with no TypeScript errors.

**Step 7: Commit**

```bash
git add -A
git commit -m "chore: verify unlock password feature end-to-end"
```

---

### Task 7: Deploy

Push to GitHub and let Vercel auto-deploy:

```bash
git push origin master
```

Monitor deployment at Vercel dashboard. No new environment variables needed — this feature uses the existing `SUPABASE_SERVICE_ROLE_KEY`.
