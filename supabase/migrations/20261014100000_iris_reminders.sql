-- Lembretes pedidos pela equipe à Íris (disparados no grupo na hora marcada)
CREATE TABLE public.iris_reminders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  remind_at TIMESTAMPTZ NOT NULL,
  chat_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sending', 'sent', 'cancelled', 'failed')),
  sent_at TIMESTAMPTZ,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX iris_reminders_due_idx ON public.iris_reminders (status, remind_at);

-- Só as funções do servidor (service role) usam esta tabela.
ALTER TABLE public.iris_reminders ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.iris_reminders TO service_role;
