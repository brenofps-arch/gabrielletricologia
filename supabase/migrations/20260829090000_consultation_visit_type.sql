-- Adiciona campos para distinguir tipo de atendimento (Retorno / Procedimento) nas consultas
ALTER TABLE public.consultations
  ADD COLUMN IF NOT EXISTS visit_type TEXT,
  ADD COLUMN IF NOT EXISTS procedure_type TEXT,
  ADD COLUMN IF NOT EXISTS procedure_number INTEGER,
  ADD COLUMN IF NOT EXISTS procedure_medications TEXT;
