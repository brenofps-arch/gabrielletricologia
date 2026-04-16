CREATE TABLE public.google_calendar_tokens (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL UNIQUE,
  access_token text NOT NULL,
  refresh_token text NOT NULL,
  expires_at timestamptz NOT NULL,
  scope text,
  calendar_id text DEFAULT 'primary',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.google_calendar_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own google tokens"
ON public.google_calendar_tokens FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users insert own google tokens"
ON public.google_calendar_tokens FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own google tokens"
ON public.google_calendar_tokens FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users delete own google tokens"
ON public.google_calendar_tokens FOR DELETE
USING (auth.uid() = user_id);

CREATE TRIGGER update_google_calendar_tokens_updated_at
BEFORE UPDATE ON public.google_calendar_tokens
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();