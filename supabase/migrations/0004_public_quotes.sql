-- InnerSpacio AI Studio — public self-serve quote flow (/get-quote)
-- Purely additive. Anonymous visitors never touch these tables directly:
-- RLS is ON with NO anon policies; all public access goes through
-- lib/leads/service.ts using the service-role key, scoped to one lead
-- resolved from a random token (only its SHA-256 hash is stored).
-- Signed-in staff can read/write for follow-up, same model as 0001.

create table if not exists leads (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  phone text not null,
  whatsapp_opt_in boolean not null default false,
  city text not null,
  bhk text not null,
  home_size text,
  package_tier text not null check (package_tier in ('essential','premium','luxury')),
  estimate_low numeric not null,
  estimate_high numeric not null,
  token_hash text not null unique,
  consent_at timestamptz not null,
  ip_hash text,
  status text not null default 'new' check (status in ('new','generated','consult_requested')),
  created_at timestamptz not null default now()
);

create table if not exists lead_rooms (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references leads(id) on delete cascade,
  room_type text not null,
  label text not null,
  ideas_text text,
  created_at timestamptz not null default now()
);

create table if not exists lead_room_photos (
  id uuid primary key default gen_random_uuid(),
  lead_room_id uuid not null references lead_rooms(id) on delete cascade,
  storage_path text not null,
  created_at timestamptz not null default now()
);

create table if not exists lead_concepts (
  id uuid primary key default gen_random_uuid(),
  lead_room_id uuid not null references lead_rooms(id) on delete cascade,
  storage_path text,
  image_data_url text, -- demo provider placeholders only (inline SVG); real images live in storage
  provider text not null,
  is_demo boolean not null default false,
  status text not null default 'ready',
  created_at timestamptz not null default now()
);

create index if not exists lead_rooms_lead_idx on lead_rooms(lead_id);
create index if not exists lead_room_photos_room_idx on lead_room_photos(lead_room_id);
create index if not exists lead_concepts_room_idx on lead_concepts(lead_room_id);
create index if not exists lead_concepts_created_idx on lead_concepts(created_at);
create index if not exists leads_created_idx on leads(created_at);

alter table leads enable row level security;
alter table lead_rooms enable row level security;
alter table lead_room_photos enable row level security;
alter table lead_concepts enable row level security;

create policy "Authenticated staff can read leads" on leads
  for select to authenticated using (true);
create policy "Authenticated staff can write leads" on leads
  for all to authenticated using (true) with check (true);

create policy "Authenticated staff can read lead_rooms" on lead_rooms
  for select to authenticated using (true);
create policy "Authenticated staff can write lead_rooms" on lead_rooms
  for all to authenticated using (true) with check (true);

create policy "Authenticated staff can read lead_room_photos" on lead_room_photos
  for select to authenticated using (true);
create policy "Authenticated staff can write lead_room_photos" on lead_room_photos
  for all to authenticated using (true) with check (true);

create policy "Authenticated staff can read lead_concepts" on lead_concepts
  for select to authenticated using (true);
create policy "Authenticated staff can write lead_concepts" on lead_concepts
  for all to authenticated using (true) with check (true);
