create table public.payments (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  user_id uuid not null,
  amount numeric not null default 0,
  payment_method text not null,
  payment_date date not null default current_date,
  status text not null default 'paid',
  description text,
  notes text,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.payments TO authenticated;
GRANT ALL ON public.payments TO service_role;

alter table public.payments enable row level security;

create policy "Users manage own payments"
on public.payments
for all
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create trigger update_payments_updated_at
before update on public.payments
for each row execute function public.update_updated_at_column();

alter table public.consultations drop constraint if exists consultations_patient_id_fkey,
  add constraint consultations_patient_id_fkey foreign key (patient_id) references public.patients(id) on delete cascade;

alter table public.appointments drop constraint if exists appointments_patient_id_fkey,
  add constraint appointments_patient_id_fkey foreign key (patient_id) references public.patients(id) on delete cascade;

alter table public.quotes drop constraint if exists quotes_patient_id_fkey,
  add constraint quotes_patient_id_fkey foreign key (patient_id) references public.patients(id) on delete cascade;

alter table public.prescriptions drop constraint if exists prescriptions_patient_id_fkey,
  add constraint prescriptions_patient_id_fkey foreign key (patient_id) references public.patients(id) on delete cascade;