CREATE TABLE public.iris_learnings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  patient_message TEXT,
  wrong_response TEXT,
  correct_response TEXT NOT NULL,
  context_note TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.iris_learnings TO authenticated;
GRANT ALL ON public.iris_learnings TO service_role;

ALTER TABLE public.iris_learnings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own learnings"
ON public.iris_learnings FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_iris_learnings_updated_at
BEFORE UPDATE ON public.iris_learnings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();