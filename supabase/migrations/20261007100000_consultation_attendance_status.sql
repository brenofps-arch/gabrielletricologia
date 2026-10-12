-- Situação do atendimento: NULL = compareceu; senão 'cancelou' | 'reagendou' | 'faltou'
ALTER TABLE public.consultations
  ADD COLUMN IF NOT EXISTS attendance_status TEXT
  CHECK (attendance_status IN ('cancelou', 'reagendou', 'faltou'));
