-- Adiciona campo para registrar exames trazidos pelo paciente na consulta
ALTER TABLE public.consultations
  ADD COLUMN IF NOT EXISTS exams_brought TEXT;
