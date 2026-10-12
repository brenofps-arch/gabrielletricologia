-- Bucket privado para os comprovantes de pagamento enviados pelos pacientes
insert into storage.buckets (id, name, public)
values ('payment-receipts', 'payment-receipts', false)
on conflict (id) do nothing;

create policy "Users can view their own payment receipt files"
  on storage.objects for select
  using (bucket_id = 'payment-receipts' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Users can upload their own payment receipt files"
  on storage.objects for insert
  with check (bucket_id = 'payment-receipts' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Users can delete their own payment receipt files"
  on storage.objects for delete
  using (bucket_id = 'payment-receipts' and (storage.foldername(name))[1] = auth.uid()::text);

-- Metadados dos comprovantes (podem ou não estar ligados a um pagamento)
create table public.payment_receipts (
  id uuid not null default gen_random_uuid() primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  payment_id uuid references public.payments(id) on delete set null,
  file_path text not null,
  file_name text not null,
  file_type text,
  file_size integer,
  receipt_date date,
  notes text,
  created_at timestamptz not null default now()
);

create index payment_receipts_patient_id_idx on public.payment_receipts (patient_id);

grant select, insert, update, delete on public.payment_receipts to authenticated;
grant all on public.payment_receipts to service_role;

alter table public.payment_receipts enable row level security;

create policy "Users manage their own payment receipts"
  on public.payment_receipts for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
