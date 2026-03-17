-- Run this in the Supabase SQL Editor

CREATE TABLE public.freeze_overrides (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  team_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  question_id uuid REFERENCES public.questions(id) ON DELETE CASCADE,
  overridden_at timestamptz DEFAULT now()
);

ALTER TABLE public.freeze_overrides ENABLE ROW LEVEL SECURITY;

-- Teams can read their own overrides (needed for Realtime)
CREATE POLICY "teams_read_own_overrides" ON public.freeze_overrides
  FOR SELECT USING (auth.uid() = team_id);

-- Enable Realtime so teams get notified instantly
ALTER PUBLICATION supabase_realtime ADD TABLE public.freeze_overrides;
