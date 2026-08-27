ALTER TABLE public.patients
  ADD COLUMN IF NOT EXISTS anamnesis jsonb,
  ADD COLUMN IF NOT EXISTS anamnesis_completed_at timestamp with time zone;