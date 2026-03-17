# Question Unlock Password Design

Date: 2026-03-17

## Summary

Questions 2–10 are gated behind a password that the admin sets alongside each question. When a team answers a question correctly and clicks "Next Question", a password modal appears. The team must enter the correct password to proceed. Q1 has no password gate. Validation is server-side only — the password is never sent to the browser.

## Database

- Add `unlock_password text NOT NULL DEFAULT ''` to `public.questions`.
- Empty string means no gate (used for Q1).
- Migration: `supabase/add_unlock_password.sql`

```sql
ALTER TABLE public.questions ADD COLUMN unlock_password text NOT NULL DEFAULT '';
```

## Server Action

New action `unlockQuestion(questionId, password)` in `app/actions/team.ts`:
- Fetches the question's `unlock_password` using the admin (service role) client.
- Compares submitted password with stored value.
- Returns `{ success: boolean }`.
- Never returns the password to the client.

## Team Dashboard

- `handleNextQuestion` in `TeamDashboardClient.tsx` checks if `data.questionIndex > 1`.
- If yes, shows a password modal (new `UnlockModal.tsx` component) instead of immediately calling `router.refresh()`.
- On successful unlock, calls `router.refresh()`.
- On failure, shows "Wrong password" error in the modal.
- Q1 (index = 1): no modal, proceeds directly.

### UnlockModal component
- Input field for password (type="password")
- "Unlock" button triggers `unlockQuestion` server action
- Error state with shake animation on wrong password
- Loading state while pending

## Admin Questions UI

- `QuestionsClient.tsx`: add "Unlock Password" field in the edit form.
- Only shown for questions with `order_index >= 2`.
- Q1 shows a greyed-out note: "No password required for Question 1".
- Saved via existing `upsertQuestion` action (add `unlockPassword` param).

## RLS / Security

- Team-facing queries explicitly select named columns, excluding `unlock_password`.
- `unlockQuestion` uses the service role client to bypass RLS for the comparison.
- Admin `getTeamQuestions` returns `unlock_password` only to admin.
