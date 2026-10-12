-- Valor da sessão dentro de um plano de tratamento (o campo price passa a ser o valor avulso)
ALTER TABLE public.procedure_prices
  ADD COLUMN IF NOT EXISTS plan_price NUMERIC(10,2);
