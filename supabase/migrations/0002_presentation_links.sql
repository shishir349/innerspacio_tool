-- InnerSpacio AI Studio — Phase 3 schema
-- Token-gated client presentation links, client decisions/feedback, a
-- versioned/published-estimate snapshot table, and an audit event log.
--
-- Security model (see README "Security architecture" for the full write-up):
--   - Designer-side reads/writes (create/revoke/regenerate a link, publish an
--     estimate version, view client feedback) go through the session-bound
--     Supabase client, same as every other table — RLS below requires
--     `authenticated`, nothing new there.
--   - Client-side reads/writes (the actual /present/[token] page and its
--     Server Actions) use the service-role client, because there is no
--     Supabase Auth session for an anonymous client visitor — RLS cannot be
--     satisfied any other way for that path. That code (lib/presentation-links/)
--     is the ONLY place allowed to use the service-role key for this feature,
--     and it always validates the token (hash lookup, revoked_at, expires_at,
--     project binding) before issuing any further query, and every subsequent
--     query is scoped to that validated project_id.
--   - RLS below deliberately grants `authenticated` SELECT on client_decisions,
--     client_feedback and presentation_audit_events but NOT INSERT/UPDATE —
--     so even a signed-in designer cannot fabricate client feedback through
--     the normal session-bound path; those rows can only be created via the
--     validated, rate-limited, token-scoped server code.

-- ─────────────────────────── presentation_links ──────────────────────────

create table if not exists presentation_links (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects (id) on delete cascade,
  token_hash text not null unique,
  created_by uuid not null references auth.users (id),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  last_accessed_at timestamptz,
  visible_room_ids uuid[],
  hidden_concept_ids uuid[] not null default '{}',
  show_location boolean not null default true,
  constraint presentation_links_expires_after_created check (expires_at > created_at)
);

create index if not exists presentation_links_project_id_idx on presentation_links (project_id);

-- At most one *active* (non-revoked) link per project — "regenerate" revokes
-- the old one and inserts a new one, rather than ever having two live links.
create unique index if not exists presentation_links_one_active_per_project
  on presentation_links (project_id)
  where revoked_at is null;

-- ────────────────────────────── estimate_versions ─────────────────────────
-- A frozen, client-safe snapshot of an estimate at the moment the designer
-- explicitly published it. The live, editable `estimates` table (0001) is
-- the designer's working draft and is never read by the client-facing page.

create table if not exists estimate_versions (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references rooms (id) on delete cascade,
  project_id uuid not null references projects (id) on delete cascade,
  version_number int not null,
  status text not null default 'published' check (status in ('published', 'superseded')),
  display_status text not null default 'preliminary' check (display_status in ('preliminary', 'final')),
  title text not null default 'Preliminary Estimate',
  -- Client-safe only: name/unit/quantity, never a rate or cost.
  line_items jsonb not null default '[]'::jsonb,
  subtotal_before_gst numeric not null check (subtotal_before_gst >= 0),
  gst_percent numeric not null check (gst_percent >= 0),
  gst_amount numeric not null check (gst_amount >= 0),
  total_client_estimate numeric not null check (total_client_estimate >= 0),
  inclusions text,
  exclusions text,
  assumptions text,
  validity_days int not null default 30 check (validity_days > 0),
  published_at timestamptz not null default now(),
  published_by uuid not null references auth.users (id),
  unique (room_id, version_number)
);

create index if not exists estimate_versions_room_id_idx on estimate_versions (room_id, version_number desc);

-- At most one *published* version per room — publishing a new one marks the
-- previous published row 'superseded' in the same transaction (see
-- lib/presentation-links/designer.ts); this index is the backstop.
create unique index if not exists estimate_versions_one_published_per_room
  on estimate_versions (room_id)
  where status = 'published';

-- ───────────────────────────── client_decisions ───────────────────────────
-- Concept selection, design approval and commercial (estimate) acceptance
-- are kept as distinct decision_type values — never conflated into one
-- generic "approved" flag.

create table if not exists client_decisions (
  id uuid primary key default gen_random_uuid(),
  presentation_link_id uuid not null references presentation_links (id) on delete cascade,
  project_id uuid not null references projects (id) on delete cascade,
  room_id uuid references rooms (id) on delete cascade,
  concept_id uuid references design_concepts (id) on delete cascade,
  estimate_version_id uuid references estimate_versions (id) on delete cascade,
  decision_type text not null check (decision_type in ('concept_selected', 'concept_approved', 'estimate_accepted')),
  created_at timestamptz not null default now()
);

create index if not exists client_decisions_link_id_idx on client_decisions (presentation_link_id, created_at desc);
create index if not exists client_decisions_project_id_idx on client_decisions (project_id);

-- ───────────────────────────── client_feedback ────────────────────────────

create table if not exists client_feedback (
  id uuid primary key default gen_random_uuid(),
  presentation_link_id uuid not null references presentation_links (id) on delete cascade,
  project_id uuid not null references projects (id) on delete cascade,
  room_id uuid references rooms (id) on delete cascade,
  concept_id uuid references design_concepts (id) on delete cascade,
  feedback_type text not null default 'comment' check (feedback_type in ('comment', 'change_request')),
  message text not null check (char_length(message) between 1 and 4000),
  created_at timestamptz not null default now()
);

create index if not exists client_feedback_link_id_idx on client_feedback (presentation_link_id, created_at desc);
create index if not exists client_feedback_project_id_idx on client_feedback (project_id);

-- ─────────────────────────── presentation_audit_events ────────────────────
-- A unified, append-only timeline: designer actions (link created/revoked/
-- regenerated, estimate published) and client actions (link viewed, concept
-- selected, feedback submitted, estimate accepted) in one place for the
-- designer's "client activity" view. client_decisions/client_feedback above
-- remain the normalized, structured records — this is the log, not the
-- source of truth.

create table if not exists presentation_audit_events (
  id uuid primary key default gen_random_uuid(),
  presentation_link_id uuid not null references presentation_links (id) on delete cascade,
  project_id uuid not null references projects (id) on delete cascade,
  event_type text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists presentation_audit_events_link_id_idx on presentation_audit_events (presentation_link_id, created_at desc);

-- ───────────────────────────── row-level security ───────────────────────

alter table presentation_links enable row level security;
alter table estimate_versions enable row level security;
alter table client_decisions enable row level security;
alter table client_feedback enable row level security;
alter table presentation_audit_events enable row level security;

-- presentation_links: designer-managed end to end via the session-bound client.
create policy "Authenticated staff can read presentation_links" on presentation_links
  for select using (auth.role() = 'authenticated');
create policy "Authenticated staff can write presentation_links" on presentation_links
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- estimate_versions: designer publishes (insert/update to mark superseded)
-- via the session-bound client; the client-facing read goes through the
-- service-role path instead (RLS doesn't apply to it, by design).
create policy "Authenticated staff can read estimate_versions" on estimate_versions
  for select using (auth.role() = 'authenticated');
create policy "Authenticated staff can write estimate_versions" on estimate_versions
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- client_decisions / client_feedback / presentation_audit_events:
-- authenticated staff may only ever READ these (to see what a client did).
-- Writes happen exclusively through the validated token flow (service-role,
-- bypassing RLS) — deliberately no authenticated insert/update/delete policy,
-- so a signed-in session can never fabricate a client's decision or feedback.
create policy "Authenticated staff can read client_decisions" on client_decisions
  for select using (auth.role() = 'authenticated');

create policy "Authenticated staff can read client_feedback" on client_feedback
  for select using (auth.role() = 'authenticated');

create policy "Authenticated staff can read presentation_audit_events" on presentation_audit_events
  for select using (auth.role() = 'authenticated');
