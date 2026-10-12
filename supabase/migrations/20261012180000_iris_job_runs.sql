-- Controle de envios automáticos da Íris (evita mandar a mesma lista duas vezes)
CREATE TABLE public.iris_job_runs (
  job TEXT NOT NULL,
  run_date DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (job, run_date)
);

-- Só as funções do servidor (service role) usam esta tabela.
ALTER TABLE public.iris_job_runs ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.iris_job_runs TO service_role;
