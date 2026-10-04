-- Local onde a doutora atende o paciente (unidade da clínica)
ALTER TABLE public.patients
  ADD COLUMN IF NOT EXISTS clinic_location TEXT;
