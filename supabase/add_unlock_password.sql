-- Add unlock_password column to questions table
-- Run this in Supabase Dashboard → SQL Editor
ALTER TABLE public.questions
  ADD COLUMN IF NOT EXISTS unlock_password text NOT NULL DEFAULT '';
