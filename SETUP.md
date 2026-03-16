# TEC Treasure Hunt — Setup Guide

## 1. Create Supabase Project

1. Go to https://supabase.com and create a new project
2. Wait for it to provision (~2 minutes)
3. Go to **Settings → API** and copy:
   - Project URL → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon` public key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` secret key → `SUPABASE_SERVICE_ROLE_KEY`

## 2. Run Database Schema

1. Go to **SQL Editor** in your Supabase dashboard
2. Paste the entire contents of `supabase/schema.sql`
3. Click **Run**

## 3. Configure Supabase Auth

1. Go to **Authentication → Settings**
2. Under **Email Auth**, disable "Confirm email" (teams won't have email access during the event)
3. Set Site URL to your Vercel deployment URL (fill in after Step 5)

## 4. Set Up Environment Variables Locally

Edit `.env.local` with your real Supabase credentials:

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

## 5. Deploy to Vercel

### Option A: Vercel Dashboard (recommended)
1. Push this repo to GitHub
2. Go to https://vercel.com → New Project → Import your GitHub repo
3. Add environment variables (from Step 3) in the Vercel project settings
4. Deploy

### Option B: Vercel CLI
```bash
npm install -g vercel
vercel --prod
```
Add environment variables when prompted, or set them in the Vercel dashboard after first deploy.

## 6. Seed the Database

After deploying, run the seed script to create team and admin accounts:

```bash
npm run seed
```

This creates:
- **Admin**: admin@hunt.local / Admin2024!Secret
- **10 Teams**: alpha@hunt.local through kappa@hunt.local (see console output for all passwords)

## 7. Set Questions (Admin Dashboard)

1. Log in at `https://your-vercel-url.vercel.app/login` with admin credentials
2. Go to **Questions** tab
3. Select each team from the dropdown
4. Fill in all 10 questions, MCQ options, correct answers, location clues, and hints
5. Click **Save Question** for each

## 8. Test Before the Event

1. Log in as a team in an incognito window
2. Verify the question loads correctly
3. Test a correct answer → location clue appears
4. Test a wrong answer → 15-minute countdown appears
5. Test hint request → admin sees it in Hints tab → mark as provided → team sees hint

## Architecture Notes

- **Team login**: Each team has a unique email/password. All teams get their own set of 10 questions.
- **Hints**: Teams request hints via the UI. Admin manually provides hints in the Hints tab. Hint text appears on the team's screen in real time via Supabase Realtime.
- **Freeze**: 15-minute UI freeze on wrong answers (client-side, enforced via localStorage).
- **Realtime**: Admin overview updates live as teams progress. Hint queue updates live on new requests.
