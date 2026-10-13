-- InnerSpacio AI Studio — Phase 1 schema
-- Projects, rooms, photos, AI analyses, design concepts, cost catalogue,
-- estimates and line items, and application settings.

create extension if not exists "pgcrypto";

create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- ─────────────────────────────── projects ───────────────────────────────

create table if not exists projects (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  client_name text not null,
  client_phone text,
  client_email text,
  location text not null,
  status text not null default 'new'
    check (status in ('new', 'in_progress', 'concept_review', 'estimate_ready', 'completed', 'on_hold')),
  budget_range_min numeric check (budget_range_min is null or budget_range_min >= 0),
  budget_range_max numeric check (budget_range_max is null or budget_range_max >= 0),
  design_preferences text,
  notes text,
  owner_id uuid references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger projects_set_updated_at
  before update on projects
  for each row execute function set_updated_at();

-- ───────────────────────────────── rooms ────────────────────────────────

create table if not exists rooms (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects (id) on delete cascade,
  name text not null,
  type text not null,
  dimension_length numeric check (dimension_length is null or dimension_length >= 0),
  dimension_width numeric check (dimension_width is null or dimension_width >= 0),
  dimension_ceiling_height numeric check (dimension_ceiling_height is null or dimension_ceiling_height >= 0),
  dimension_unit text not null default 'ft' check (dimension_unit in ('ft', 'm')),
  existing_condition_notes text,
  preferred_style text,
  preferred_color_palette text,
  storage_requirements text,
  material_preferences text,
  budget numeric check (budget is null or budget >= 0),
  constraints text,
  selected_concept_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists rooms_project_id_idx on rooms (project_id);

create trigger rooms_set_updated_at
  before update on rooms
  for each row execute function set_updated_at();

-- ─────────────────────────────── room photos ────────────────────────────

create table if not exists room_photos (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references rooms (id) on delete cascade,
  url text not null,
  storage_path text,
  caption text,
  is_primary boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists room_photos_room_id_idx on room_photos (room_id);

-- ────────────────────────────── room analyses ───────────────────────────
-- One row per "Analyze Room with AI" run. The latest row per room is shown
-- to the designer; analysis is advisory and must be reviewed before use.

create table if not exists room_analyses (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references rooms (id) on delete cascade,
  analysis jsonb not null,
  designer_notes text,
  reviewed_by_designer boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists room_analyses_room_id_idx on room_analyses (room_id, created_at desc);

-- ────────────────────────────── design concepts ─────────────────────────

create table if not exists design_concepts (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references rooms (id) on delete cascade,
  title text not null,
  style text not null,
  description text not null,
  key_changes jsonb not null default '[]'::jsonb,
  image_url text not null,
  provider text not null,
  status text not null default 'demo' check (status in ('demo', 'generated', 'failed', 'pending')),
  is_selected boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists design_concepts_room_id_idx on design_concepts (room_id);

alter table rooms
  add constraint rooms_selected_concept_fk
  foreign key (selected_concept_id) references design_concepts (id) on delete set null;

-- ────────────────────────────── cost catalogue ──────────────────────────

create table if not exists cost_catalogue_items (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null check (category in (
    'civil_demolition', 'waterproofing', 'plumbing', 'electrical', 'tiling_stone',
    'sanitaryware', 'carpentry_modular', 'wardrobes_storage', 'painting_finishes',
    'lighting', 'false_ceiling', 'hardware', 'glass_mirrors', 'labour',
    'design_pm', 'miscellaneous'
  )),
  unit text not null,
  base_cost_per_unit numeric not null check (base_cost_per_unit >= 0),
  default_quantity numeric check (default_quantity is null or default_quantity >= 0),
  selling_description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger cost_catalogue_items_set_updated_at
  before update on cost_catalogue_items
  for each row execute function set_updated_at();

-- ─────────────────────────────── estimates ──────────────────────────────

create table if not exists estimates (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references rooms (id) on delete cascade,
  project_id uuid not null references projects (id) on delete cascade,
  concept_id uuid references design_concepts (id) on delete set null,
  additional_costs jsonb not null default '[]'::jsonb,
  direct_cost numeric not null,
  contingency_percent numeric not null check (contingency_percent >= 0 and contingency_percent < 100),
  contingency_amount numeric not null,
  cost_basis numeric not null,
  target_gross_margin_percent numeric not null check (target_gross_margin_percent >= 0 and target_gross_margin_percent < 100),
  target_selling_subtotal numeric not null,
  gross_profit numeric not null,
  actual_gross_margin_percent numeric not null,
  gst_percent numeric not null check (gst_percent >= 0),
  gst_amount numeric not null,
  total_client_estimate numeric not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists estimates_room_id_key on estimates (room_id);

create trigger estimates_set_updated_at
  before update on estimates
  for each row execute function set_updated_at();

create table if not exists estimate_line_items (
  id uuid primary key default gen_random_uuid(),
  estimate_id uuid not null references estimates (id) on delete cascade,
  catalogue_item_id uuid references cost_catalogue_items (id) on delete set null,
  name text not null,
  unit text not null,
  base_cost_per_unit numeric not null check (base_cost_per_unit >= 0),
  quantity numeric not null check (quantity >= 0),
  line_direct_cost numeric not null
);

create index if not exists estimate_line_items_estimate_id_idx on estimate_line_items (estimate_id);

-- ───────────────────────────── app settings ─────────────────────────────

create table if not exists app_settings (
  id text primary key default 'default',
  target_gross_margin_percent numeric not null default 40,
  default_contingency_percent numeric not null default 8,
  gst_percent numeric not null default 18,
  currency text not null default 'INR',
  image_generation_provider text not null default 'demo',
  updated_at timestamptz not null default now()
);

create trigger app_settings_set_updated_at
  before update on app_settings
  for each row execute function set_updated_at();

insert into app_settings (id) values ('default') on conflict (id) do nothing;

-- ───────────────────────────── row-level security ───────────────────────
-- Internal studio tool: any signed-in staff member may read/write studio
-- data. No anonymous access. Review and tighten before adding external
-- (e.g. client-facing) roles in a later phase.

alter table projects enable row level security;
alter table rooms enable row level security;
alter table room_photos enable row level security;
alter table room_analyses enable row level security;
alter table design_concepts enable row level security;
alter table cost_catalogue_items enable row level security;
alter table estimates enable row level security;
alter table estimate_line_items enable row level security;
alter table app_settings enable row level security;

create policy "Authenticated staff can read projects" on projects
  for select using (auth.role() = 'authenticated');
create policy "Authenticated staff can write projects" on projects
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create policy "Authenticated staff can read rooms" on rooms
  for select using (auth.role() = 'authenticated');
create policy "Authenticated staff can write rooms" on rooms
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create policy "Authenticated staff can read room_photos" on room_photos
  for select using (auth.role() = 'authenticated');
create policy "Authenticated staff can write room_photos" on room_photos
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create policy "Authenticated staff can read room_analyses" on room_analyses
  for select using (auth.role() = 'authenticated');
create policy "Authenticated staff can write room_analyses" on room_analyses
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create policy "Authenticated staff can read design_concepts" on design_concepts
  for select using (auth.role() = 'authenticated');
create policy "Authenticated staff can write design_concepts" on design_concepts
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create policy "Authenticated staff can read cost_catalogue_items" on cost_catalogue_items
  for select using (auth.role() = 'authenticated');
create policy "Authenticated staff can write cost_catalogue_items" on cost_catalogue_items
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create policy "Authenticated staff can read estimates" on estimates
  for select using (auth.role() = 'authenticated');
create policy "Authenticated staff can write estimates" on estimates
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create policy "Authenticated staff can read estimate_line_items" on estimate_line_items
  for select using (auth.role() = 'authenticated');
create policy "Authenticated staff can write estimate_line_items" on estimate_line_items
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create policy "Authenticated staff can read app_settings" on app_settings
  for select using (auth.role() = 'authenticated');
create policy "Authenticated staff can write app_settings" on app_settings
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- ─────────────────────────────── storage ────────────────────────────────
-- Private bucket for room photographs. Signed URLs only — never public.

insert into storage.buckets (id, name, public)
values ('room-photos', 'room-photos', false)
on conflict (id) do nothing;

create policy "Authenticated staff can read room photo objects"
  on storage.objects for select
  using (bucket_id = 'room-photos' and auth.role() = 'authenticated');

create policy "Authenticated staff can upload room photo objects"
  on storage.objects for insert
  with check (bucket_id = 'room-photos' and auth.role() = 'authenticated');

create policy "Authenticated staff can delete room photo objects"
  on storage.objects for delete
  using (bucket_id = 'room-photos' and auth.role() = 'authenticated');
