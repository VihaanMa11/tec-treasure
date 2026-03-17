-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Questions table (one row per team per question, 5 per team)
CREATE TABLE public.questions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  team_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  order_index int NOT NULL CHECK (order_index BETWEEN 1 AND 5),
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
