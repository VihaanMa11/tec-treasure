-- Add started_at column to team_progress (records when admin started the hunt)
ALTER TABLE public.team_progress
  ADD COLUMN IF NOT EXISTS started_at timestamptz DEFAULT now();
