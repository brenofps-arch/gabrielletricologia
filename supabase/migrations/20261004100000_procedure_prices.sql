-- Cardápio de procedimentos: valor de cada sessão, usado para montar orçamentos
CREATE TABLE public.procedure_prices (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  price NUMERIC(10,2) NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.procedure_prices TO authenticated;
GRANT ALL ON public.procedure_prices TO service_role;

ALTER TABLE public.procedure_prices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own procedure prices"
  ON public.procedure_prices FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
