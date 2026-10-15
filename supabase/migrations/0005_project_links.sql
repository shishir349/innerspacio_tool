-- InnerSpacio AI Studio — everything hangs off a project.
-- Leads get a project; BOQs are saved under a project. Purely additive.

alter table leads add column if not exists project_id uuid references projects (id) on delete set null;
create index if not exists leads_project_idx on leads (project_id);

create table if not exists boqs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects (id) on delete cascade,
  lead_id uuid references leads (id) on delete set null,
  title text not null,
  tier text not null,
  city text not null,
  sheet text not null default 'spazay',
  total numeric not null default 0,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists boqs_project_idx on boqs (project_id, updated_at desc);

create trigger boqs_set_updated_at
  before update on boqs
  for each row execute function set_updated_at();

alter table boqs enable row level security;

create policy "Authenticated staff can read boqs" on boqs
  for select to authenticated using (true);
create policy "Authenticated staff can write boqs" on boqs
  for all to authenticated using (true) with check (true);
