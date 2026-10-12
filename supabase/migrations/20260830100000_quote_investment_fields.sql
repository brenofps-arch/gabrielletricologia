-- Novos campos para o modelo de orcamento em pacote (o que esta incluso + faixas de preco)
ALTER TABLE public.quotes
  ADD COLUMN IF NOT EXISTS included_items TEXT,
  ADD COLUMN IF NOT EXISTS package_name TEXT,
  ADD COLUMN IF NOT EXISTS price_full NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS price_3x NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS price_6x NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS pix_key TEXT;
