# Scripts

## Seed Script

Run once before the event to create team and admin accounts in Supabase.

### Prerequisites
1. Create a Supabase project at https://supabase.com
2. Run `supabase/schema.sql` in the Supabase Dashboard SQL Editor
3. Fill in `.env.local` with your real Supabase URL and service role key

### Run
```bash
npm run seed
```

### What it creates
- 1 admin account: admin@hunt.local
- 10 team accounts: alpha@hunt.local through kappa@hunt.local
- team_progress rows for each team (starting at question 1)

### Re-running
The script is idempotent — running it again will skip existing accounts.
