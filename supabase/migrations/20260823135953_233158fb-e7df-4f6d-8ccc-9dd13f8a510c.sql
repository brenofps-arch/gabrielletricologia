alter table public.patients add column if not exists referral_source text;

alter table public.payments add column if not exists paid_at timestamp with time zone;
alter table public.payments add column if not exists quote_id uuid references public.quotes(id) on delete set null;

alter table public.quotes add column if not exists payment_status text default 'pending';
alter table public.quotes add column if not exists payment_method text;
alter table public.quotes add column if not exists payment_date date;
alter table public.quotes add column if not exists paid_amount numeric default 0;
alter table public.quotes add column if not exists payment_notes text;