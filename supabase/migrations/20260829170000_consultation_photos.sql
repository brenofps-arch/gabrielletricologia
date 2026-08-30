-- Bucket privado de armazenamento para fotos tiradas durante a consulta (tricoscopia, couro cabeludo, etc.)
insert into storage.buckets (id, name, public)
values ('consultation-photos', 'consultation-photos', false)
on conflict (id) do nothing;

create policy "Users can view their own consultation photos"
  on storage.objects for select
  using (bucket_id = 'consultation-photos' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Users can upload their own consultation photos"
  on storage.objects for insert
  with check (bucket_id = 'consultation-photos' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Users can delete their own consultation photos"
  on storage.objects for delete
  using (bucket_id = 'consultation-photos' and (storage.foldername(name))[1] = auth.uid()::text);

-- Metadados das fotos anexadas a cada consulta
create table public.consultation_photos (
  id uuid not null default gen_random_uuid() primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  consultation_id uuid not null references public.consultations(id) on delete cascade,
  file_path text not null,
  file_name text not null,
  file_type text,
  file_size integer,
  created_at timestamptz not null default now()
);

grant select, insert, update, delete on public.consultation_photos to authenticated;
grant all on public.consultation_photos to service_role;

alter table public.consultation_photos enable row level security;

create policy "Users manage their own consultation photos"
  on public.consultation_photos for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
