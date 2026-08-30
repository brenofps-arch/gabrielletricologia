-- Bucket privado de armazenamento para os arquivos de exames laboratoriais dos pacientes
insert into storage.buckets (id, name, public)
values ('lab-exams', 'lab-exams', false)
on conflict (id) do nothing;

create policy "Users can view their own lab exam files"
  on storage.objects for select
  using (bucket_id = 'lab-exams' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Users can upload their own lab exam files"
  on storage.objects for insert
  with check (bucket_id = 'lab-exams' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Users can delete their own lab exam files"
  on storage.objects for delete
  using (bucket_id = 'lab-exams' and (storage.foldername(name))[1] = auth.uid()::text);

-- Metadados dos exames laboratoriais enviados pelo paciente
create table public.lab_exams (
  id uuid not null default gen_random_uuid() primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  file_path text not null,
  file_name text not null,
  file_type text,
  file_size integer,
  exam_date date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

grant select, insert, update, delete on public.lab_exams to authenticated;
grant all on public.lab_exams to service_role;

alter table public.lab_exams enable row level security;

create policy "Users manage their own lab exams"
  on public.lab_exams for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create trigger update_lab_exams_updated_at
  before update on public.lab_exams
  for each row execute function public.update_updated_at_column();
