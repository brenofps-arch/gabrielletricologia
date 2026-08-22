-- Adiciona campo de origem do paciente
ALTER TABLE public.patients
  ADD COLUMN IF NOT EXISTS referral_source TEXT;
