ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS installments INTEGER;
