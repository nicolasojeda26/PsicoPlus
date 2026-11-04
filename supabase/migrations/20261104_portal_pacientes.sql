-- Portal de pacientes: el link que el profesional comparte lee sus sedes, horarios y turnos ocupados
-- desde acá (sin datos de pacientes) y las solicitudes de turno le llegan a su cuenta.

-- Datos públicos del portal de cada profesional (perfil, sedes, horarios, horarios ocupados).
create table if not exists public.portal_publico (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  data       jsonb       not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.portal_publico enable row level security;

drop policy if exists "portal_publico_select_all" on public.portal_publico;
create policy "portal_publico_select_all" on public.portal_publico
  for select using (true);

drop policy if exists "portal_publico_insert_own" on public.portal_publico;
create policy "portal_publico_insert_own" on public.portal_publico
  for insert with check (auth.uid() = user_id);

drop policy if exists "portal_publico_update_own" on public.portal_publico;
create policy "portal_publico_update_own" on public.portal_publico
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Solicitudes de turno que hacen los pacientes desde el link.
create table if not exists public.portal_solicitudes (
  id             uuid primary key default gen_random_uuid(),
  profesional_id uuid not null references auth.users (id) on delete cascade,
  turno          jsonb not null,
  created_at     timestamptz not null default now()
);

create index if not exists portal_solicitudes_profesional_idx on public.portal_solicitudes (profesional_id);

alter table public.portal_solicitudes enable row level security;

-- Cualquiera con el link puede pedir un turno, solo a un profesional con portal publicado.
drop policy if exists "portal_solicitudes_insert_public" on public.portal_solicitudes;
create policy "portal_solicitudes_insert_public" on public.portal_solicitudes
  for insert with check (
    exists (select 1 from public.portal_publico p where p.user_id = profesional_id)
    and octet_length(turno::text) < 8000
  );

-- Solo el profesional ve y borra sus solicitudes.
drop policy if exists "portal_solicitudes_select_own" on public.portal_solicitudes;
create policy "portal_solicitudes_select_own" on public.portal_solicitudes
  for select using (auth.uid() = profesional_id);

drop policy if exists "portal_solicitudes_delete_own" on public.portal_solicitudes;
create policy "portal_solicitudes_delete_own" on public.portal_solicitudes
  for delete using (auth.uid() = profesional_id);
