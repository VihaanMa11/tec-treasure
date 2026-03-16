# Treasure Hunt Platform — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a full-stack Next.js 14 treasure hunt platform for 10 teams with participant and admin dashboards backed by Supabase.

**Architecture:** App Router + Supabase Auth + Server Actions. Supabase Auth manages sessions with role stored in `user_metadata`. Server Actions handle all mutations. Supabase Realtime powers live admin monitoring and hint delivery.

**Tech Stack:** Next.js 14 App Router, TypeScript, Tailwind CSS, Supabase (Auth + Postgres + Realtime), Vercel, Vitest for unit tests.

---

## Task 1: Scaffold the Next.js project

**Files:**
- Create: `package.json`, project root

**Step 1: Run the scaffold command**

From `c:/Users/vihaa/Desktop/tec_tresure`, run:
```bash
npx create-next-app@14 . --typescript --tailwind --eslint --app --no-src-dir --import-alias "@/*"
```
When prompted, accept all defaults (App Router: Yes).

**Step 2: Install Supabase and test dependencies**

```bash
npm install @supabase/supabase-js @supabase/ssr
npm install -D vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/jest-dom
```

**Step 3: Add Vitest config**

Create `vitest.config.ts`:
```typescript
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    globals: true,
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, '.') },
  },
})
```

Create `vitest.setup.ts`:
```typescript
import '@testing-library/jest-dom'
```

Add to `package.json` scripts:
```json
"test": "vitest run",
"test:watch": "vitest"
```

**Step 4: Verify scaffold**

Run: `npm run dev`
Expected: Next.js dev server starts on http://localhost:3000

**Step 5: Commit**
```bash
git init
git add .
git commit -m "feat: scaffold Next.js 14 project with Supabase deps"
```

---

## Task 2: Configure environment variables

**Files:**
- Create: `.env.local`
- Create: `.env.example`
- Modify: `.gitignore`

**Step 1: Create Supabase project (manual)**

1. Go to https://supabase.com → New Project
2. Name it `tec-treasure-hunt`, choose a strong DB password, pick nearest region
3. Wait ~2 minutes for provisioning
4. Go to **Project Settings → API**
5. Copy: **Project URL**, **anon public key**, **service_role key**

**Step 2: Create `.env.local`**

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
```

**Step 3: Create `.env.example`**

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
```

**Step 4: Ensure `.env.local` is gitignored**

Verify `.gitignore` already contains `.env*.local` — if not, add it.

**Step 5: Commit**
```bash
git add .env.example .gitignore
git commit -m "feat: add environment variable config"
```

---

## Task 3: Run database schema migrations

**Files:**
- Create: `supabase/schema.sql`

**Step 1: Create the schema file**

Create `supabase/schema.sql`:
```sql
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Questions table (one row per team per question, 10 per team)
CREATE TABLE public.questions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  team_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  order_index int NOT NULL CHECK (order_index BETWEEN 1 AND 10),
  question_text text NOT NULL DEFAULT '',
  option_a text NOT NULL DEFAULT '',
  option_b text NOT NULL DEFAULT '',
  option_c text NOT NULL DEFAULT '',
  option_d text NOT NULL DEFAULT '',
  correct_option char(1) NOT NULL DEFAULT 'a' CHECK (correct_option IN ('a','b','c','d')),
  location_clue text NOT NULL DEFAULT '',
  hint_1 text DEFAULT '',
  hint_2 text DEFAULT '',
  hint_3 text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  UNIQUE(team_id, order_index)
);

-- Team progress (one row per team)
CREATE TABLE public.team_progress (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  team_id uuid REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  current_question_index int DEFAULT 1,
  completed_at timestamptz
);

-- Answer attempts log
CREATE TABLE public.attempts (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  team_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  question_id uuid REFERENCES public.questions(id) ON DELETE CASCADE,
  selected_option char(1) NOT NULL,
  is_correct bool NOT NULL,
  attempted_at timestamptz DEFAULT now()
);

-- Hint requests
CREATE TABLE public.hint_requests (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  team_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  question_id uuid REFERENCES public.questions(id) ON DELETE CASCADE,
  hint_number int NOT NULL CHECK (hint_number BETWEEN 1 AND 3),
  requested_at timestamptz DEFAULT now(),
  provided_at timestamptz,
  UNIQUE(team_id, question_id, hint_number)
);

-- Row Level Security
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hint_requests ENABLE ROW LEVEL SECURITY;

-- Teams can only read their own questions
CREATE POLICY "teams_read_own_questions" ON public.questions
  FOR SELECT USING (auth.uid() = team_id);

-- Teams can only read/write their own progress
CREATE POLICY "teams_read_own_progress" ON public.team_progress
  FOR SELECT USING (auth.uid() = team_id);

-- Teams can insert their own attempts
CREATE POLICY "teams_insert_own_attempts" ON public.attempts
  FOR INSERT WITH CHECK (auth.uid() = team_id);

CREATE POLICY "teams_read_own_attempts" ON public.attempts
  FOR SELECT USING (auth.uid() = team_id);

-- Teams can read/insert their own hint requests
CREATE POLICY "teams_read_own_hints" ON public.hint_requests
  FOR SELECT USING (auth.uid() = team_id);

CREATE POLICY "teams_insert_own_hints" ON public.hint_requests
  FOR INSERT WITH CHECK (auth.uid() = team_id);

-- Enable Realtime on team_progress and hint_requests
ALTER PUBLICATION supabase_realtime ADD TABLE public.team_progress;
ALTER PUBLICATION supabase_realtime ADD TABLE public.hint_requests;
```

**Step 2: Run the SQL in Supabase**

1. Go to Supabase Dashboard → **SQL Editor**
2. Paste the contents of `supabase/schema.sql`
3. Click **Run**
4. Verify all tables appear under **Table Editor**

**Step 3: Commit**
```bash
git add supabase/schema.sql
git commit -m "feat: add database schema and RLS policies"
```

---

## Task 4: Create Supabase client utilities

**Files:**
- Create: `lib/supabase/client.ts`
- Create: `lib/supabase/server.ts`
- Create: `lib/supabase/admin.ts`

**Step 1: Write tests for client creation**

Create `lib/supabase/__tests__/clients.test.ts`:
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock env vars
vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://test.supabase.co')
vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'test-anon-key')
vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'test-service-key')

describe('Supabase client utilities', () => {
  it('browser client is created without throwing', async () => {
    const { createClient } = await import('../client')
    expect(() => createClient()).not.toThrow()
  })

  it('admin client is created without throwing', async () => {
    const { createClient } = await import('../admin')
    expect(() => createClient()).not.toThrow()
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — modules not found

**Step 3: Create `lib/supabase/client.ts`**

```typescript
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

**Step 4: Create `lib/supabase/server.ts`**

```typescript
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Server Component — cookie setting is a no-op
          }
        },
      },
    }
  )
}
```

**Step 5: Create `lib/supabase/admin.ts`**

```typescript
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

export function createClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  )
}
```

**Step 6: Run tests to verify they pass**

Run: `npm test`
Expected: PASS

**Step 7: Commit**
```bash
git add lib/
git commit -m "feat: add Supabase client utilities"
```

---

## Task 5: Implement auth middleware

**Files:**
- Create: `middleware.ts`

**Step 1: Write the middleware**

Create `middleware.ts` at the project root:
```typescript
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  const path = request.nextUrl.pathname

  // Unauthenticated users: redirect to /login except for login page itself
  if (!user && path !== '/login') {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  if (user) {
    const role = user.user_metadata?.role as string | undefined

    // Already logged in users visiting /login → redirect to their dashboard
    if (path === '/login') {
      const dest = role === 'admin' ? '/admin' : '/team/dashboard'
      return NextResponse.redirect(new URL(dest, request.url))
    }

    // Root redirect
    if (path === '/') {
      const dest = role === 'admin' ? '/admin' : '/team/dashboard'
      return NextResponse.redirect(new URL(dest, request.url))
    }

    // Role-based access control
    if (path.startsWith('/admin') && role !== 'admin') {
      return NextResponse.redirect(new URL('/team/dashboard', request.url))
    }
    if (path.startsWith('/team') && role !== 'team') {
      return NextResponse.redirect(new URL('/admin', request.url))
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
```

**Step 2: Verify dev server still starts**

Run: `npm run dev`
Expected: No errors on startup.

**Step 3: Commit**
```bash
git add middleware.ts
git commit -m "feat: add auth middleware with role-based routing"
```

---

## Task 6: Global layout and theme

**Files:**
- Modify: `app/layout.tsx`
- Modify: `app/globals.css`
- Modify: `tailwind.config.ts`

**Step 1: Update `tailwind.config.ts`**

```typescript
import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          bg: '#0a0a0f',
          surface: '#0f0f1a',
          card: '#1a1a2e',
          blue: '#3b82f6',
          'blue-light': '#60a5fa',
          gold: '#f59e0b',
          'gold-light': '#fbbf24',
        },
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      animation: {
        'pulse-red': 'pulseRed 1.5s ease-in-out infinite',
        'glow': 'glow 2s ease-in-out infinite',
      },
      keyframes: {
        pulseRed: {
          '0%, 100%': { boxShadow: '0 0 20px rgba(239, 68, 68, 0.5)' },
          '50%': { boxShadow: '0 0 40px rgba(239, 68, 68, 0.9)' },
        },
        glow: {
          '0%, 100%': { boxShadow: '0 0 10px rgba(59, 130, 246, 0.3)' },
          '50%': { boxShadow: '0 0 25px rgba(59, 130, 246, 0.6)' },
        },
      },
    },
  },
  plugins: [],
}
export default config
```

**Step 2: Update `app/globals.css`**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

html, body {
  background-color: #0a0a0f;
  color: white;
  font-family: 'Inter', system-ui, sans-serif;
}

@layer utilities {
  .card-glow {
    box-shadow: 0 0 20px rgba(59, 130, 246, 0.15);
    border: 1px solid rgba(59, 130, 246, 0.3);
  }
  .gold-text {
    color: #f59e0b;
    text-shadow: 0 0 10px rgba(245, 158, 11, 0.5);
  }
}
```

**Step 3: Update `app/layout.tsx`**

```typescript
import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'TEC Treasure Hunt',
  description: 'College Treasure Hunt Competition Platform',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-brand-bg text-white min-h-screen antialiased">
        {children}
      </body>
    </html>
  )
}
```

**Step 4: Delete the boilerplate home page**

Delete `app/page.tsx` and replace with a simple redirect:

```typescript
// app/page.tsx
import { redirect } from 'next/navigation'

export default function Home() {
  redirect('/login')
}
```

**Step 5: Commit**
```bash
git add app/ tailwind.config.ts
git commit -m "feat: configure dark theme and global layout"
```

---

## Task 7: Login page

**Files:**
- Create: `app/login/page.tsx`

**Step 1: Create the login page**

```typescript
// app/login/page.tsx
'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { data, error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError('Invalid credentials. Check your email and password.')
      setLoading(false)
      return
    }

    const role = data.user?.user_metadata?.role
    router.push(role === 'admin' ? '/admin' : '/team/dashboard')
    router.refresh()
  }

  return (
    <div className="min-h-screen bg-brand-bg flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo/Title */}
        <div className="text-center mb-8">
          <div className="inline-block p-3 rounded-xl bg-brand-blue/10 border border-brand-blue/30 mb-4">
            <span className="text-4xl">🔍</span>
          </div>
          <h1 className="text-4xl font-bold text-white tracking-tight">
            TEC <span className="text-brand-blue-light">Treasure</span> Hunt
          </h1>
          <p className="text-gray-400 mt-2 text-sm">Enter your credentials to begin the hunt</p>
        </div>

        {/* Login Card */}
        <div className="bg-brand-surface border border-brand-blue/20 rounded-2xl p-8 card-glow">
          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="block text-xs text-gray-400 uppercase tracking-widest mb-2">
                Team Email
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="team@example.com"
                required
                className="w-full px-4 py-3 bg-brand-card border border-brand-blue/20 rounded-xl text-white placeholder-gray-600 focus:outline-none focus:border-brand-blue transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs text-gray-400 uppercase tracking-widest mb-2">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full px-4 py-3 bg-brand-card border border-brand-blue/20 rounded-xl text-white placeholder-gray-600 focus:outline-none focus:border-brand-blue transition-colors"
              />
            </div>

            {error && (
              <div className="px-4 py-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-brand-blue hover:bg-blue-700 text-white font-semibold rounded-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-[0_0_20px_rgba(59,130,246,0.4)]"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Authenticating...
                </span>
              ) : (
                'Enter the Hunt →'
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
```

**Step 2: Test in browser**

Run: `npm run dev`
Navigate to http://localhost:3000/login
Expected: Login form renders with dark theme, electric blue accents.

**Step 3: Commit**
```bash
git add app/login/
git commit -m "feat: add login page with dark theme"
```

---

## Task 8: Server Actions — team

**Files:**
- Create: `app/actions/team.ts`
- Create: `app/actions/__tests__/team.test.ts`

**Step 1: Write tests for freeze timer logic**

Create `lib/utils/__tests__/freeze.test.ts`:
```typescript
import { describe, it, expect } from 'vitest'
import { getFreezeKey, isFrozen, getFreezeRemainingMs } from '../freeze'

describe('freeze utilities', () => {
  it('generates correct localStorage key', () => {
    expect(getFreezeKey('team-1', 'q-1')).toBe('freeze_until_team-1_q-1')
  })

  it('returns false when no freeze key in storage', () => {
    // localStorage is empty in test env
    expect(isFrozen('team-1', 'q-1')).toBe(false)
  })

  it('returns true when freeze timestamp is in the future', () => {
    const future = new Date(Date.now() + 10 * 60 * 1000).toISOString()
    localStorage.setItem(getFreezeKey('team-1', 'q-1'), future)
    expect(isFrozen('team-1', 'q-1')).toBe(true)
    localStorage.clear()
  })

  it('returns false when freeze timestamp is in the past', () => {
    const past = new Date(Date.now() - 1000).toISOString()
    localStorage.setItem(getFreezeKey('team-1', 'q-1'), past)
    expect(isFrozen('team-1', 'q-1')).toBe(false)
    localStorage.clear()
  })

  it('returns remaining ms correctly', () => {
    const tenMinutes = 10 * 60 * 1000
    const future = new Date(Date.now() + tenMinutes).toISOString()
    localStorage.setItem(getFreezeKey('t', 'q'), future)
    const remaining = getFreezeRemainingMs('t', 'q')
    expect(remaining).toBeGreaterThan(tenMinutes - 1000)
    expect(remaining).toBeLessThanOrEqual(tenMinutes)
    localStorage.clear()
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — module not found

**Step 3: Create `lib/utils/freeze.ts`**

```typescript
export const FREEZE_DURATION_MS = 15 * 60 * 1000 // 15 minutes

export function getFreezeKey(teamId: string, questionId: string): string {
  return `freeze_until_${teamId}_${questionId}`
}

export function isFrozen(teamId: string, questionId: string): boolean {
  if (typeof window === 'undefined') return false
  const val = localStorage.getItem(getFreezeKey(teamId, questionId))
  if (!val) return false
  return new Date(val).getTime() > Date.now()
}

export function getFreezeRemainingMs(teamId: string, questionId: string): number {
  if (typeof window === 'undefined') return 0
  const val = localStorage.getItem(getFreezeKey(teamId, questionId))
  if (!val) return 0
  return Math.max(0, new Date(val).getTime() - Date.now())
}

export function setFreeze(teamId: string, questionId: string): void {
  const until = new Date(Date.now() + FREEZE_DURATION_MS).toISOString()
  localStorage.setItem(getFreezeKey(teamId, questionId), until)
}

export function clearFreeze(teamId: string, questionId: string): void {
  localStorage.removeItem(getFreezeKey(teamId, questionId))
}
```

**Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS (5 tests)

**Step 5: Create `app/actions/team.ts`**

```typescript
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
  hint_1: string | null
  hint_2: string | null
  hint_3: string | null
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

  // Fetch question using admin client to access correct_option
  const { data: question } = await adminSupabase
    .from('questions')
    .select('correct_option, location_clue, team_id, order_index')
    .eq('id', questionId)
    .single()

  if (!question || question.team_id !== user.id) throw new Error('Invalid question')

  const isCorrect = question.correct_option === selectedOption

  // Log attempt
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
  const { error } = await adminSupabase.from('hint_requests').insert({
    team_id: user.id,
    question_id: questionId,
    hint_number: hintNumber,
  })

  if (error && error.code !== '23505') throw error // ignore unique constraint (already requested)
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

  return (data ?? []).map(r => r.hint_number)
}
```

**Step 6: Commit**
```bash
git add app/actions/ lib/utils/
git commit -m "feat: add team server actions and freeze utilities"
```

---

## Task 9: Team dashboard — UI

**Files:**
- Create: `app/team/dashboard/page.tsx`
- Create: `app/team/dashboard/TeamDashboardClient.tsx`
- Create: `app/team/dashboard/FreezeOverlay.tsx`
- Create: `app/team/dashboard/HintSection.tsx`
- Create: `app/team/layout.tsx`

**Step 1: Create team layout**

```typescript
// app/team/layout.tsx
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function TeamLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.user_metadata?.role !== 'team') redirect('/login')
  return <>{children}</>
}
```

**Step 2: Create `app/team/dashboard/page.tsx`**

```typescript
import { getCurrentQuestion } from '@/app/actions/team'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import TeamDashboardClient from './TeamDashboardClient'

export default async function TeamDashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const data = await getCurrentQuestion()

  return (
    <TeamDashboardClient
      initialData={data}
      teamName={user.user_metadata?.team_name ?? 'Team'}
      teamId={user.id}
    />
  )
}
```

**Step 3: Create `app/team/dashboard/FreezeOverlay.tsx`**

```typescript
'use client'
import { useState, useEffect } from 'react'

interface FreezeOverlayProps {
  remainingMs: number
  onExpired: () => void
}

export default function FreezeOverlay({ remainingMs, onExpired }: FreezeOverlayProps) {
  const [ms, setMs] = useState(remainingMs)

  useEffect(() => {
    if (ms <= 0) { onExpired(); return }
    const interval = setInterval(() => {
      setMs(prev => {
        if (prev <= 1000) { onExpired(); return 0 }
        return prev - 1000
      })
    }, 1000)
    return () => clearInterval(interval)
  }, [ms, onExpired])

  const totalSeconds = Math.ceil(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60).toString().padStart(2, '0')
  const seconds = (totalSeconds % 60).toString().padStart(2, '0')

  return (
    <div className="fixed inset-0 z-50 bg-black/90 flex flex-col items-center justify-center animate-pulse-red">
      <div className="text-center p-12 rounded-3xl border-2 border-red-500 bg-brand-surface shadow-[0_0_60px_rgba(239,68,68,0.4)]">
        <div className="text-6xl mb-6">🔒</div>
        <h2 className="text-3xl font-bold text-red-400 mb-2">Incorrect Answer</h2>
        <p className="text-gray-400 mb-8">Please wait before trying again</p>
        <div className="text-7xl font-mono font-bold text-red-300 tracking-wider">
          {minutes}:{seconds}
        </div>
        <p className="text-gray-500 mt-4 text-sm">Screen unlocks automatically</p>
      </div>
    </div>
  )
}
```

**Step 4: Create `app/team/dashboard/HintSection.tsx`**

```typescript
'use client'
import { useState, useTransition } from 'react'
import { requestHint } from '@/app/actions/team'

interface HintSectionProps {
  questionId: string
  hintsUsed: number
  providedHintNumbers: number[]
  hintTexts: (string | null)[]
}

export default function HintSection({
  questionId, hintsUsed, providedHintNumbers, hintTexts
}: HintSectionProps) {
  const [localHintsUsed, setLocalHintsUsed] = useState(hintsUsed)
  const [requesting, startTransition] = useTransition()

  function handleRequestHint() {
    if (localHintsUsed >= 3) return
    const nextHint = localHintsUsed + 1
    startTransition(async () => {
      await requestHint(questionId, nextHint)
      setLocalHintsUsed(nextHint)
    })
  }

  return (
    <div className="mt-6 p-5 bg-brand-card border border-brand-gold/20 rounded-xl">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs text-gray-400 uppercase tracking-widest">Hints</span>
        <div className="flex gap-1">
          {[1, 2, 3].map(n => (
            <div
              key={n}
              className={`w-6 h-6 rounded-full border-2 transition-colors ${
                n <= localHintsUsed
                  ? 'bg-brand-gold border-brand-gold'
                  : 'bg-transparent border-gray-600'
              }`}
            />
          ))}
        </div>
      </div>

      {/* Show provided hints */}
      {providedHintNumbers.map(num => (
        <div key={num} className="mb-2 px-4 py-3 bg-brand-gold/10 border border-brand-gold/30 rounded-lg">
          <span className="text-xs text-brand-gold uppercase tracking-wider">Hint {num}: </span>
          <span className="text-gray-200 text-sm">{hintTexts[num - 1]}</span>
        </div>
      ))}

      {localHintsUsed < 3 && (
        <button
          onClick={handleRequestHint}
          disabled={requesting}
          className="w-full py-2 mt-2 border border-brand-gold/40 text-brand-gold hover:bg-brand-gold/10 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
        >
          {requesting ? 'Requesting...' : `Request Hint ${localHintsUsed + 1} / 3`}
        </button>
      )}

      {localHintsUsed > 0 && !providedHintNumbers.includes(localHintsUsed) && (
        <p className="text-center text-gray-500 text-xs mt-2">
          Hint requested — waiting for admin to provide it...
        </p>
      )}

      {localHintsUsed >= 3 && providedHintNumbers.length < 3 && (
        <p className="text-center text-gray-500 text-xs mt-2">All hints requested</p>
      )}
    </div>
  )
}
```

**Step 5: Create `app/team/dashboard/TeamDashboardClient.tsx`**

```typescript
'use client'
import { useState, useEffect, useTransition, useCallback } from 'react'
import { submitAnswer, getProvidedHints } from '@/app/actions/team'
import { isFrozen, getFreezeRemainingMs, setFreeze } from '@/lib/utils/freeze'
import { createClient } from '@/lib/supabase/client'
import type { DashboardData, Question } from '@/app/actions/team'
import FreezeOverlay from './FreezeOverlay'
import HintSection from './HintSection'
import { useRouter } from 'next/navigation'

interface Props {
  initialData: DashboardData
  teamName: string
  teamId: string
}

const OPTIONS = ['a', 'b', 'c', 'd'] as const
const LABELS = ['A', 'B', 'C', 'D']

export default function TeamDashboardClient({ initialData, teamName, teamId }: Props) {
  const router = useRouter()
  const [data, setData] = useState(initialData)
  const [selectedOption, setSelectedOption] = useState<string | null>(null)
  const [result, setResult] = useState<{ correct: boolean; clue: string } | null>(null)
  const [frozen, setFrozen] = useState(false)
  const [freezeMs, setFreezeMs] = useState(0)
  const [providedHints, setProvidedHints] = useState<number[]>([])
  const [isPending, startTransition] = useTransition()

  const question = data.completed ? null : data.question

  // Check freeze on mount and when question changes
  useEffect(() => {
    if (!question) return
    if (isFrozen(teamId, question.id)) {
      setFrozen(true)
      setFreezeMs(getFreezeRemainingMs(teamId, question.id))
    }
  }, [teamId, question])

  // Load provided hints on mount
  useEffect(() => {
    if (!question) return
    getProvidedHints(question.id).then(setProvidedHints)
  }, [question])

  // Subscribe to Realtime for hint updates
  useEffect(() => {
    if (!question) return
    const supabase = createClient()
    const channel = supabase
      .channel(`hints_${teamId}_${question.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'hint_requests',
          filter: `team_id=eq.${teamId}`,
        },
        () => {
          getProvidedHints(question.id).then(setProvidedHints)
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [teamId, question])

  function handleFreezeExpired() {
    setFrozen(false)
    setFreezeMs(0)
  }

  function handleSubmit() {
    if (!selectedOption || !question || isPending || frozen) return

    startTransition(async () => {
      const res = await submitAnswer(question.id, selectedOption)

      if (res.correct) {
        setResult({ correct: true, clue: res.clue! })
      } else {
        setFreeze(teamId, question.id)
        setFreezeMs(getFreezeRemainingMs(teamId, question.id))
        setFrozen(true)
        setSelectedOption(null)
      }
    })
  }

  function handleNextQuestion() {
    setResult(null)
    setSelectedOption(null)
    router.refresh()
  }

  if (data.completed) {
    return (
      <div className="min-h-screen bg-brand-bg flex items-center justify-center p-4">
        <div className="text-center">
          <div className="text-8xl mb-6">🏆</div>
          <h1 className="text-4xl font-bold text-brand-gold mb-2">Hunt Complete!</h1>
          <p className="text-gray-400">Congratulations, {teamName}! You've found all the clues.</p>
        </div>
      </div>
    )
  }

  if (!question) return null

  const optionValues = [question.option_a, question.option_b, question.option_c, question.option_d]

  return (
    <div className="min-h-screen bg-brand-bg">
      {frozen && <FreezeOverlay remainingMs={freezeMs} onExpired={handleFreezeExpired} />}

      {/* Header */}
      <header className="border-b border-brand-blue/20 bg-brand-surface/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <span className="text-xs text-gray-500 uppercase tracking-widest">Team</span>
            <p className="text-white font-semibold">{teamName}</p>
          </div>
          <div className="text-center">
            <span className="text-xs text-gray-500 uppercase tracking-widest">Progress</span>
            <p className="text-brand-blue-light font-bold">
              Question {data.questionIndex} <span className="text-gray-600">/ 10</span>
            </p>
          </div>
          <form action="/api/logout" method="post">
            <button
              type="button"
              onClick={async () => {
                const supabase = createClient()
                await supabase.auth.signOut()
                router.push('/login')
              }}
              className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
            >
              Logout
            </button>
          </form>
        </div>
        {/* Progress bar */}
        <div className="max-w-3xl mx-auto px-4 pb-3">
          <div className="h-1 bg-brand-card rounded-full">
            <div
              className="h-1 bg-brand-blue rounded-full transition-all duration-500"
              style={{ width: `${((data.questionIndex - 1) / 10) * 100}%` }}
            />
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8">
        {result ? (
          /* Correct answer — show clue */
          <div className="text-center">
            <div className="text-6xl mb-6">✅</div>
            <h2 className="text-2xl font-bold text-green-400 mb-2">Correct!</h2>
            <p className="text-gray-400 mb-8">Your next location clue:</p>
            <div className="p-8 bg-brand-surface border border-brand-gold/40 rounded-2xl shadow-[0_0_30px_rgba(245,158,11,0.15)] mb-8">
              <p className="text-2xl font-mono gold-text font-semibold leading-relaxed">
                {result.clue}
              </p>
            </div>
            {data.questionIndex < 10 ? (
              <button
                onClick={handleNextQuestion}
                className="px-8 py-3 bg-brand-blue hover:bg-blue-700 text-white font-semibold rounded-xl transition-all hover:shadow-[0_0_20px_rgba(59,130,246,0.4)]"
              >
                Next Question →
              </button>
            ) : (
              <button
                onClick={handleNextQuestion}
                className="px-8 py-3 bg-brand-gold hover:bg-amber-600 text-black font-semibold rounded-xl transition-all"
              >
                Finish Hunt 🏆
              </button>
            )}
          </div>
        ) : (
          /* Question card */
          <div>
            <div className="mb-8 p-8 bg-brand-surface border border-brand-blue/20 rounded-2xl card-glow">
              <p className="text-xs text-gray-500 uppercase tracking-widest mb-4">
                Question {data.questionIndex} of 10
              </p>
              <p className="text-xl text-white leading-relaxed font-medium">
                {question.question_text}
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-8">
              {OPTIONS.map((opt, idx) => (
                <button
                  key={opt}
                  onClick={() => setSelectedOption(opt)}
                  disabled={isPending}
                  className={`p-4 rounded-xl border-2 text-left transition-all font-medium ${
                    selectedOption === opt
                      ? 'border-brand-blue bg-brand-blue/10 text-brand-blue-light shadow-[0_0_15px_rgba(59,130,246,0.3)]'
                      : 'border-brand-blue/20 bg-brand-surface text-gray-300 hover:border-brand-blue/50 hover:bg-brand-card'
                  }`}
                >
                  <span className="inline-block w-7 h-7 rounded-lg bg-brand-card text-xs font-bold text-center leading-7 mr-3 border border-brand-blue/30">
                    {LABELS[idx]}
                  </span>
                  {optionValues[idx]}
                </button>
              ))}
            </div>

            <button
              onClick={handleSubmit}
              disabled={!selectedOption || isPending}
              className="w-full py-4 bg-brand-blue hover:bg-blue-700 text-white font-bold rounded-xl transition-all disabled:opacity-40 disabled:cursor-not-allowed hover:shadow-[0_0_20px_rgba(59,130,246,0.4)] text-lg"
            >
              {isPending ? 'Checking...' : 'Submit Answer'}
            </button>

            <HintSection
              questionId={question.id}
              hintsUsed={data.hintsUsed}
              providedHintNumbers={providedHints}
              hintTexts={[question.hint_1, question.hint_2, question.hint_3]}
            />
          </div>
        )}
      </main>
    </div>
  )
}
```

**Step 6: Verify team dashboard renders**

Run: `npm run dev`
Expected: No TypeScript errors. Page at `/team/dashboard` redirects to `/login` if unauthenticated.

**Step 7: Commit**
```bash
git add app/team/
git commit -m "feat: add team dashboard with MCQ, freeze overlay, and hints"
```

---

## Task 10: Server Actions — admin

**Files:**
- Create: `app/actions/admin.ts`

**Step 1: Create `app/actions/admin.ts`**

```typescript
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

  // Return 10 slots, filling in existing data
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
```

**Step 2: Commit**
```bash
git add app/actions/admin.ts
git commit -m "feat: add admin server actions"
```

---

## Task 11: Admin dashboard — Overview tab

**Files:**
- Create: `app/admin/layout.tsx`
- Create: `app/admin/page.tsx`
- Create: `app/admin/AdminOverviewClient.tsx`

**Step 1: Create `app/admin/layout.tsx`**

```typescript
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.user_metadata?.role !== 'admin') redirect('/login')

  return (
    <div className="min-h-screen bg-brand-bg">
      <header className="border-b border-brand-blue/20 bg-brand-surface sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-xl font-bold text-white">
            🔍 <span className="text-brand-blue-light">Admin</span> Control Panel
          </h1>
          <nav className="flex gap-1">
            {[
              { href: '/admin', label: 'Overview' },
              { href: '/admin/questions', label: 'Questions' },
              { href: '/admin/hints', label: 'Hints' },
              { href: '/admin/teams', label: 'Teams' },
            ].map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                className="px-4 py-2 rounded-lg text-sm text-gray-400 hover:text-white hover:bg-brand-card transition-colors"
              >
                {label}
              </Link>
            ))}
          </nav>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-4 py-8">{children}</main>
    </div>
  )
}
```

**Step 2: Create `app/admin/page.tsx`**

```typescript
import { getAllTeamsProgress } from '@/app/actions/admin'
import AdminOverviewClient from './AdminOverviewClient'

export default async function AdminPage() {
  const teams = await getAllTeamsProgress()
  return <AdminOverviewClient initialTeams={teams} />
}
```

**Step 3: Create `app/admin/AdminOverviewClient.tsx`**

```typescript
'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getAllTeamsProgress, type TeamProgress } from '@/app/actions/admin'

export default function AdminOverviewClient({ initialTeams }: { initialTeams: TeamProgress[] }) {
  const [teams, setTeams] = useState(initialTeams)

  // Subscribe to real-time progress updates
  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel('admin_team_progress')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'team_progress' }, () => {
        getAllTeamsProgress().then(setTeams)
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  const completed = teams.filter(t => t.completedAt).length

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h2 className="text-2xl font-bold text-white">Live Team Progress</h2>
        <div className="flex gap-4 text-sm">
          <span className="px-3 py-1 bg-green-500/10 border border-green-500/30 rounded-full text-green-400">
            {completed} Completed
          </span>
          <span className="px-3 py-1 bg-brand-blue/10 border border-brand-blue/30 rounded-full text-brand-blue-light">
            {teams.length - completed} In Progress
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {teams.map(team => (
          <div
            key={team.id}
            className={`p-5 rounded-2xl border ${
              team.completedAt
                ? 'border-green-500/40 bg-green-500/5'
                : 'border-brand-blue/20 bg-brand-surface card-glow'
            }`}
          >
            <div className="flex items-start justify-between mb-3">
              <div>
                <p className="font-semibold text-white text-sm">{team.teamName}</p>
                <p className="text-xs text-gray-500 mt-0.5">{team.email}</p>
              </div>
              {team.completedAt ? (
                <span className="text-xl">🏆</span>
              ) : (
                <span className="text-xs text-brand-blue-light font-mono bg-brand-blue/10 px-2 py-0.5 rounded">
                  Q{team.currentIndex}/10
                </span>
              )}
            </div>

            {/* Progress bar */}
            <div className="h-1.5 bg-brand-card rounded-full">
              <div
                className={`h-1.5 rounded-full transition-all duration-700 ${
                  team.completedAt ? 'bg-green-500' : 'bg-brand-blue'
                }`}
                style={{
                  width: `${team.completedAt ? 100 : ((team.currentIndex - 1) / 10) * 100}%`
                }}
              />
            </div>
            <p className="text-xs text-gray-600 mt-1.5">
              {team.completedAt
                ? 'Finished!'
                : `${team.currentIndex - 1} of 10 questions solved`}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}
```

**Step 4: Commit**
```bash
git add app/admin/
git commit -m "feat: add admin overview with real-time team progress grid"
```

---

## Task 12: Admin — Questions management tab

**Files:**
- Create: `app/admin/questions/page.tsx`
- Create: `app/admin/questions/QuestionsClient.tsx`

**Step 1: Create `app/admin/questions/page.tsx`**

```typescript
import { getAllTeamUsers, getTeamQuestions } from '@/app/actions/admin'
import QuestionsClient from './QuestionsClient'

export default async function QuestionsPage() {
  const teams = await getAllTeamUsers()
  return <QuestionsClient teams={teams} />
}
```

**Step 2: Create `app/admin/questions/QuestionsClient.tsx`**

```typescript
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
  const [isPending, startTransition] = useTransition()
  const [saved, setSaved] = useState<number | null>(null)

  function loadTeam(teamId: string) {
    setSelectedTeamId(teamId)
    setLoaded(false)
    setEditing(null)
    startTransition(async () => {
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
    startTransition(async () => {
      await upsertQuestion({
        teamId: selectedTeamId,
        orderIndex: editing,
        questionText: form.question_text ?? '',
        optionA: form.option_a ?? '', optionB: form.option_b ?? '',
        optionC: form.option_c ?? '', optionD: form.option_d ?? '',
        correctOption: form.correct_option ?? 'a',
        locationClue: form.location_clue ?? '',
        hint1: form.hint_1 ?? '', hint2: form.hint_2 ?? '', hint3: form.hint_3 ?? '',
      })
      const updated = await getTeamQuestions(selectedTeamId)
      setQuestions(updated)
      setEditing(null)
      setSaved(editing)
      setTimeout(() => setSaved(null), 2000)
    })
  }

  const field = (key: keyof TeamQuestion, label: string, multiline = false) => (
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
            className="px-4 py-2 bg-brand-blue hover:bg-blue-700 text-white text-sm rounded-xl transition-colors"
          >
            Load Questions
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
                  <div className="flex gap-3 pt-2">
                    <button
                      onClick={saveQuestion}
                      disabled={isPending}
                      className="px-5 py-2 bg-brand-blue hover:bg-blue-700 text-white text-sm rounded-xl transition-colors disabled:opacity-50"
                    >
                      {isPending ? 'Saving...' : 'Save Question'}
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
                <p className="text-sm text-gray-400 truncate">
                  {q.question_text || <span className="text-gray-600 italic">Not set yet</span>}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
```

**Step 3: Commit**
```bash
git add app/admin/questions/
git commit -m "feat: add admin questions management tab"
```

---

## Task 13: Admin — Hints queue tab

**Files:**
- Create: `app/admin/hints/page.tsx`
- Create: `app/admin/hints/HintsClient.tsx`

**Step 1: Create `app/admin/hints/page.tsx`**

```typescript
import { getPendingHints } from '@/app/actions/admin'
import HintsClient from './HintsClient'

export default async function HintsPage() {
  const hints = await getPendingHints()
  return <HintsClient initialHints={hints} />
}
```

**Step 2: Create `app/admin/hints/HintsClient.tsx`**

```typescript
'use client'
import { useState, useTransition, useEffect } from 'react'
import { getPendingHints, markHintProvided, type HintRequest } from '@/app/actions/admin'
import { createClient } from '@/lib/supabase/client'

export default function HintsClient({ initialHints }: { initialHints: HintRequest[] }) {
  const [hints, setHints] = useState(initialHints)
  const [isPending, startTransition] = useTransition()

  // Real-time: reload when new hint request comes in
  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel('admin_hint_requests')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'hint_requests' }, () => {
        getPendingHints().then(setHints)
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [])

  function handleProvide(id: string) {
    startTransition(async () => {
      await markHintProvided(id)
      const updated = await getPendingHints()
      setHints(updated)
    })
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h2 className="text-2xl font-bold text-white">Hint Requests</h2>
        <span className={`px-3 py-1 rounded-full text-sm font-medium ${
          hints.length > 0
            ? 'bg-amber-500/10 border border-amber-500/30 text-amber-400'
            : 'bg-gray-500/10 border border-gray-700 text-gray-500'
        }`}>
          {hints.length} pending
        </span>
      </div>

      {hints.length === 0 ? (
        <div className="text-center py-20 text-gray-600">
          <p className="text-4xl mb-4">✓</p>
          <p>No pending hint requests</p>
        </div>
      ) : (
        <div className="space-y-3">
          {hints.map(h => (
            <div
              key={h.id}
              className="flex items-center justify-between p-5 bg-brand-surface border border-amber-500/20 rounded-xl"
            >
              <div className="flex items-center gap-6">
                <div>
                  <p className="font-semibold text-white">{h.teamName}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Question {h.questionIndex} · Hint {h.hintNumber}
                  </p>
                </div>
                <div className="text-xs text-gray-600">
                  {new Date(h.requestedAt).toLocaleTimeString()}
                </div>
              </div>
              <button
                onClick={() => handleProvide(h.id)}
                disabled={isPending}
                className="px-5 py-2 bg-brand-gold hover:bg-amber-600 text-black font-semibold text-sm rounded-xl transition-colors disabled:opacity-50"
              >
                Mark Provided
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
```

**Step 3: Commit**
```bash
git add app/admin/hints/
git commit -m "feat: add admin hints queue tab"
```

---

## Task 14: Admin — Teams management tab

**Files:**
- Create: `app/admin/teams/page.tsx`
- Create: `app/admin/teams/TeamsClient.tsx`

**Step 1: Create `app/admin/teams/page.tsx`**

```typescript
import { getAllTeamsProgress } from '@/app/actions/admin'
import TeamsClient from './TeamsClient'

export default async function TeamsPage() {
  const teams = await getAllTeamsProgress()
  return <TeamsClient initialTeams={teams} />
}
```

**Step 2: Create `app/admin/teams/TeamsClient.tsx`**

```typescript
'use client'
import { useState, useTransition } from 'react'
import { resetTeamProgress, getAllTeamsProgress, type TeamProgress } from '@/app/actions/admin'

export default function TeamsClient({ initialTeams }: { initialTeams: TeamProgress[] }) {
  const [teams, setTeams] = useState(initialTeams)
  const [isPending, startTransition] = useTransition()
  const [resetting, setResetting] = useState<string | null>(null)
  const [resetDone, setResetDone] = useState<string | null>(null)

  function handleReset(teamId: string, teamName: string) {
    if (!confirm(`Reset all progress for ${teamName}? This cannot be undone.`)) return
    setResetting(teamId)
    startTransition(async () => {
      await resetTeamProgress(teamId)
      const updated = await getAllTeamsProgress()
      setTeams(updated)
      setResetting(null)
      setResetDone(teamId)
      setTimeout(() => setResetDone(null), 3000)
    })
  }

  return (
    <div>
      <h2 className="text-2xl font-bold text-white mb-8">Team Management</h2>

      <div className="border border-brand-blue/20 rounded-2xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-brand-blue/20 bg-brand-surface">
              <th className="text-left px-6 py-4 text-xs text-gray-500 uppercase tracking-widest">Team</th>
              <th className="text-left px-6 py-4 text-xs text-gray-500 uppercase tracking-widest">Email</th>
              <th className="text-left px-6 py-4 text-xs text-gray-500 uppercase tracking-widest">Progress</th>
              <th className="text-left px-6 py-4 text-xs text-gray-500 uppercase tracking-widest">Status</th>
              <th className="text-right px-6 py-4 text-xs text-gray-500 uppercase tracking-widest">Actions</th>
            </tr>
          </thead>
          <tbody>
            {teams.map((team, idx) => (
              <tr
                key={team.id}
                className={`border-b border-brand-blue/10 ${idx % 2 === 0 ? 'bg-brand-bg' : 'bg-brand-surface/30'}`}
              >
                <td className="px-6 py-4 font-medium text-white">{team.teamName}</td>
                <td className="px-6 py-4 text-gray-400 text-sm">{team.email}</td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-24 h-1.5 bg-brand-card rounded-full">
                      <div
                        className={`h-1.5 rounded-full ${team.completedAt ? 'bg-green-500' : 'bg-brand-blue'}`}
                        style={{ width: `${team.completedAt ? 100 : ((team.currentIndex - 1) / 10) * 100}%` }}
                      />
                    </div>
                    <span className="text-xs text-gray-500">
                      {team.completedAt ? '10/10' : `${team.currentIndex - 1}/10`}
                    </span>
                  </div>
                </td>
                <td className="px-6 py-4">
                  {team.completedAt ? (
                    <span className="text-xs text-green-400 bg-green-500/10 px-2 py-1 rounded-full">Completed</span>
                  ) : team.currentIndex > 1 ? (
                    <span className="text-xs text-brand-blue-light bg-brand-blue/10 px-2 py-1 rounded-full">In Progress</span>
                  ) : (
                    <span className="text-xs text-gray-500 bg-gray-800 px-2 py-1 rounded-full">Not Started</span>
                  )}
                </td>
                <td className="px-6 py-4 text-right">
                  {resetDone === team.id ? (
                    <span className="text-xs text-green-400">✓ Reset</span>
                  ) : (
                    <button
                      onClick={() => handleReset(team.id, team.teamName)}
                      disabled={isPending && resetting === team.id}
                      className="text-xs text-red-400 hover:text-red-300 border border-red-500/30 hover:border-red-500/60 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                    >
                      {resetting === team.id ? 'Resetting...' : 'Reset Progress'}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
```

**Step 3: Commit**
```bash
git add app/admin/teams/
git commit -m "feat: add admin teams management tab with progress reset"
```

---

## Task 15: Seed script — create teams and admin user

**Files:**
- Create: `scripts/seed.ts`

**Step 1: Create `scripts/seed.ts`**

```typescript
// Run with: npx tsx scripts/seed.ts
import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

const TEAMS = [
  { name: 'Team Alpha',   email: 'alpha@hunt.local',   password: 'alpha2024' },
  { name: 'Team Beta',    email: 'beta@hunt.local',    password: 'beta2024' },
  { name: 'Team Gamma',   email: 'gamma@hunt.local',   password: 'gamma2024' },
  { name: 'Team Delta',   email: 'delta@hunt.local',   password: 'delta2024' },
  { name: 'Team Epsilon', email: 'epsilon@hunt.local', password: 'epsilon2024' },
  { name: 'Team Zeta',    email: 'zeta@hunt.local',    password: 'zeta2024' },
  { name: 'Team Eta',     email: 'eta@hunt.local',     password: 'eta2024' },
  { name: 'Team Theta',   email: 'theta@hunt.local',   password: 'theta2024' },
  { name: 'Team Iota',    email: 'iota@hunt.local',    password: 'iota2024' },
  { name: 'Team Kappa',   email: 'kappa@hunt.local',   password: 'kappa2024' },
]

const ADMIN = { email: 'admin@hunt.local', password: 'admin2024!' }

async function seed() {
  console.log('🌱 Seeding users...\n')

  // Create admin
  const { data: adminData, error: adminError } = await supabase.auth.admin.createUser({
    email: ADMIN.email,
    password: ADMIN.password,
    email_confirm: true,
    user_metadata: { role: 'admin', team_name: 'Admin' },
  })
  if (adminError && !adminError.message.includes('already registered')) {
    console.error('Admin error:', adminError.message)
  } else {
    console.log(`✅ Admin: ${ADMIN.email} / ${ADMIN.password}`)
  }

  // Create teams
  for (const team of TEAMS) {
    const { data, error } = await supabase.auth.admin.createUser({
      email: team.email,
      password: team.password,
      email_confirm: true,
      user_metadata: { role: 'team', team_name: team.name },
    })

    if (error && !error.message.includes('already registered')) {
      console.error(`Error creating ${team.name}:`, error.message)
      continue
    }

    const userId = data?.user?.id
    if (!userId) continue

    // Initialize team progress
    await supabase.from('team_progress').upsert(
      { team_id: userId, current_question_index: 1 },
      { onConflict: 'team_id' }
    )

    console.log(`✅ ${team.name}: ${team.email} / ${team.password}`)
  }

  console.log('\n✨ Seeding complete!')
  console.log('\nCredentials summary:')
  console.log('-------------------')
  console.log(`Admin:    ${ADMIN.email} / ${ADMIN.password}`)
  TEAMS.forEach(t => console.log(`${t.name.padEnd(15)} ${t.email} / ${t.password}`))
}

seed().catch(console.error)
```

**Step 2: Install tsx for running scripts**

```bash
npm install -D tsx
```

**Step 3: Run the seed script**

```bash
npx tsx scripts/seed.ts
```

Expected output: 11 ✅ lines (1 admin + 10 teams)

**Step 4: Verify in Supabase Dashboard**

Go to Supabase → **Authentication → Users**. Confirm 11 users exist.

**Step 5: Commit**
```bash
git add scripts/seed.ts
git commit -m "feat: add seed script for teams and admin users"
```

---

## Task 16: Run full test suite and verify

**Step 1: Run all unit tests**

```bash
npm test
```
Expected: All tests pass (freeze utility tests + client creation tests)

**Step 2: Run TypeScript check**

```bash
npx tsc --noEmit
```
Expected: No errors

**Step 3: Smoke test in browser**

Run: `npm run dev`

Verify these flows manually:
1. Navigate to http://localhost:3000 → redirects to `/login`
2. Login as admin (`admin@hunt.local` / `admin2024!`) → reaches `/admin`
3. Admin Overview shows 10 team cards
4. Admin Questions → select a team → edit Q1 → save
5. Admin Teams → all 10 teams visible
6. Logout → back to `/login`
7. Login as team (`alpha@hunt.local` / `alpha2024`) → reaches `/team/dashboard`
8. See Q1, select an answer, submit
9. Wrong answer → freeze overlay with 15:00 countdown
10. Correct answer → gold clue reveals

**Step 4: Commit**
```bash
git add .
git commit -m "chore: verify all flows working"
```

---

## Task 17: Deploy to Vercel

**Step 1: Push to GitHub**

```bash
# Create a new repo on github.com first, then:
git remote add origin https://github.com/YOUR_USERNAME/tec-treasure-hunt.git
git branch -M main
git push -u origin main
```

**Step 2: Import to Vercel**

1. Go to https://vercel.com → New Project → Import from GitHub
2. Select `tec-treasure-hunt` repo
3. Framework: **Next.js** (auto-detected)
4. Click **Environment Variables** and add:
   - `NEXT_PUBLIC_SUPABASE_URL` = your value
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = your value
   - `SUPABASE_SERVICE_ROLE_KEY` = your value
5. Click **Deploy**

**Step 3: Configure Supabase Auth redirect URLs**

In Supabase → **Authentication → URL Configuration**:
- Site URL: `https://your-vercel-app.vercel.app`
- Redirect URLs: add `https://your-vercel-app.vercel.app/**`

**Step 4: Verify production**

Navigate to the Vercel URL and repeat the smoke test from Task 16 Step 3.

**Step 5: Final commit (if any config changes)**
```bash
git add .
git commit -m "chore: production deployment verified"
git push
```

---

## Quick Reference

### Credentials (after seeding)
| Role | Email | Password |
|---|---|---|
| Admin | admin@hunt.local | admin2024! |
| Team Alpha | alpha@hunt.local | alpha2024 |
| Team Beta | beta@hunt.local | beta2024 |
| ... | ... | ... |

### Key file locations
| Purpose | File |
|---|---|
| Supabase browser client | `lib/supabase/client.ts` |
| Supabase server client | `lib/supabase/server.ts` |
| Supabase admin client | `lib/supabase/admin.ts` |
| Auth middleware | `middleware.ts` |
| Team server actions | `app/actions/team.ts` |
| Admin server actions | `app/actions/admin.ts` |
| Freeze utilities | `lib/utils/freeze.ts` |
| DB schema | `supabase/schema.sql` |
| Seed script | `scripts/seed.ts` |
