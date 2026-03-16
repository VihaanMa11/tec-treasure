# Treasure Hunt Platform — Design Document
**Date:** 2026-03-16
**Stack:** Next.js 14 App Router, TypeScript, Tailwind CSS, Supabase, Vercel

---

## Overview

A full-stack web platform for a college treasure hunt competition. 10 teams each receive a unique sequence of 10 questions. Teams answer MCQs; correct answers reveal a physical location clue. Wrong answers freeze the UI for 15 minutes with a countdown. Admins manage questions, monitor progress in real time, and respond to hint requests.

---

## Architecture

**Approach:** App Router + Supabase Auth + Server Actions

- Supabase Auth manages sessions for both teams and admin
- Role (`team` | `admin`) stored in Supabase `user_metadata`
- Next.js middleware enforces route protection and role separation
- Server Actions handle all mutations (answer submission, hint requests, admin operations)
- Supabase Realtime powers live admin monitoring and hint delivery to teams
- Deployed to Vercel

### Route Layout

```
/                     → redirect to /login
/login                → shared login page (role-based redirect after auth)
/team/dashboard       → participant dashboard (team role only)
/admin                → admin overview — live team progress grid (admin role only)
/admin/questions      → manage questions & clues per team
/admin/hints          → hint request queue
/admin/teams          → team credentials & progress reset
```

### Auth Flow

1. User submits email + password on `/login`
2. Supabase Auth validates credentials, returns session
3. App reads `user_metadata.role` — redirects `team` → `/team/dashboard`, `admin` → `/admin`
4. Next.js middleware (`middleware.ts`) checks session on every request, enforces role boundaries
5. Teams cannot access `/admin/*`; admins cannot access `/team/*`

### Freeze State

Stored in `localStorage` with key `freeze_until_<team_id>_<question_id>` (ISO timestamp). On dashboard mount, checks if freeze is still active and shows countdown. Client-side only — acceptable per requirements.

---

## Database Schema

### `users` (Supabase Auth)
Managed by Supabase Auth. Role and team name stored in `user_metadata`:
- `role`: `'team'` | `'admin'`
- `team_name`: display name for the team

### `questions`
| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `team_id` | uuid FK → auth.users | owning team |
| `order_index` | int | 1–10, sequence for this team |
| `question_text` | text | |
| `option_a` | text | |
| `option_b` | text | |
| `option_c` | text | |
| `option_d` | text | |
| `correct_option` | char(1) | 'a', 'b', 'c', or 'd' |
| `location_clue` | text | revealed on correct answer |
| `hint_1` | text | |
| `hint_2` | text | |
| `hint_3` | text | |
| `created_at` | timestamptz | |

### `team_progress`
| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `team_id` | uuid FK → auth.users | unique |
| `current_question_index` | int | default 1 |
| `completed_at` | timestamptz | null until all 10 done |

### `attempts`
| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `team_id` | uuid FK | |
| `question_id` | uuid FK | |
| `selected_option` | char(1) | |
| `is_correct` | bool | |
| `attempted_at` | timestamptz | |

### `hint_requests`
| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `team_id` | uuid FK | |
| `question_id` | uuid FK | |
| `hint_number` | int | 1, 2, or 3 |
| `requested_at` | timestamptz | |
| `provided_at` | timestamptz | null until admin marks provided |

### Row Level Security
- Teams: can only SELECT/INSERT their own rows (filter by `auth.uid()`)
- Admin operations (reset, hint provision, question management): use Supabase service role key in Server Actions, bypassing RLS

---

## UI Design

### Theme
- Background: `#0a0a0f` (near-black)
- Primary accent: electric blue (`#3b82f6` / `#60a5fa`)
- Highlight: gold (`#f59e0b`)
- Monospace font for clue reveals
- Subtle glowing borders on active cards

### Participant Dashboard (`/team/dashboard`)

- **Header:** team name, "Question X of 10", logout button
- **Question card:** question text + 4 MCQ buttons (A/B/C/D)
- **Correct answer:** card animates → location clue revealed in gold monospace text → "Proceed to Next Question" button
- **Wrong answer:** full-screen dark overlay, pulsing red border, `MM:SS` countdown timer, message "Incorrect — try again in 14:32"
- **Hints section:** "Hints: X/3" indicator, "Request Hint" button (disabled after 3 uses), hint text appears via Realtime when admin marks as provided

### Admin Dashboard

**Overview tab (`/admin`):**
- Live grid of 10 team cards — team name + progress bar ("Question X / 10")
- Updates in real time via Supabase Realtime on `team_progress` table

**Questions tab (`/admin/questions`):**
- Dropdown to select team
- List of 10 questions with inline edit form (text, options A–D, correct answer, location clue, hints 1–3)

**Hints tab (`/admin/hints`):**
- Table: team name, question #, hint #, time requested, "Mark as Provided" button
- Providing a hint triggers Realtime update → hint text appears on team's screen

**Teams tab (`/admin/teams`):**
- List of all teams with email, current question progress
- "Reset Progress" button — clears `team_progress` and `attempts` for that team

---

## Data Flow

1. Team logs in → middleware validates role → redirects to `/team/dashboard`
2. Dashboard loads current question via Server Action (reads `team_progress.current_question_index`, fetches matching question)
3. Team selects answer → Server Action logs attempt, checks correctness
   - Correct: returns `location_clue`, Server Action increments `current_question_index`
   - Wrong: client stores freeze timestamp in `localStorage`, UI shows countdown
4. Team requests hint → Server Action inserts into `hint_requests`
5. Admin marks hint provided → Server Action sets `provided_at`, Realtime event fires → team's dashboard receives hint text
6. Admin resets team → Server Action deletes `team_progress` + `attempts` rows, reinitializes progress at index 1

---

## Key Decisions

| Decision | Choice | Reason |
|---|---|---|
| Auth | Supabase Auth | Native DB integration, RLS, no extra deps |
| Mutations | Server Actions | No separate API layer needed |
| Realtime | Supabase Realtime | Built-in, works with existing tables |
| Freeze enforcement | Client-side localStorage | Sufficient per requirements |
| Questions per team | Separate rows with `team_id` FK | Simple queries, easy admin editing |
