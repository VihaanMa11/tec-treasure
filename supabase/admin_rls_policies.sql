-- Run this in the Supabase SQL Editor
-- Adds admin read policies so Realtime works in the browser for the admin user

CREATE POLICY "admin_read_all_progress" ON public.team_progress
  FOR SELECT USING (
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
  );

CREATE POLICY "admin_read_all_attempts" ON public.attempts
  FOR SELECT USING (
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
  );

CREATE POLICY "admin_read_all_hints" ON public.hint_requests
  FOR SELECT USING (
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
  );

CREATE POLICY "admin_read_all_questions" ON public.questions
  FOR SELECT USING (
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
  );

CREATE POLICY "admin_read_all_overrides" ON public.freeze_overrides
  FOR SELECT USING (
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
  );

-- Enable Realtime on attempts table (needed for frozen teams detection)
ALTER PUBLICATION supabase_realtime ADD TABLE public.attempts;
