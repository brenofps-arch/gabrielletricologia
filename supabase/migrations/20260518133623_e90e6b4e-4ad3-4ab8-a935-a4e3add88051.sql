
-- Enable scheduling extensions
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Table to store scheduled WhatsApp reminders (decoupled from Google Calendar)
CREATE TABLE IF NOT EXISTS public.appointment_reminders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  google_event_id TEXT,
  patient_phone TEXT NOT NULL,
  patient_name TEXT,
  appointment_at TIMESTAMP WITH TIME ZONE NOT NULL,
  message TEXT NOT NULL,
  send_at TIMESTAMP WITH TIME ZONE NOT NULL,
  sent_at TIMESTAMP WITH TIME ZONE,
  status TEXT NOT NULL DEFAULT 'pending',
  error TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_appt_reminders_due ON public.appointment_reminders(status, send_at);

ALTER TABLE public.appointment_reminders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own reminders" ON public.appointment_reminders FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users create own reminders" ON public.appointment_reminders FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own reminders" ON public.appointment_reminders FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own reminders" ON public.appointment_reminders FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_appt_reminders_updated_at
BEFORE UPDATE ON public.appointment_reminders
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
