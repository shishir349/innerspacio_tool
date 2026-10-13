-- InnerSpacio AI Studio — Design Studio enhancements
-- Purely additive: a structured design-brief column on rooms, and a
-- storage_path column on design_concepts so real provider-generated
-- concept images can be persisted to the existing private storage bucket
-- (room-photos) and read back via short-lived signed URLs, the same
-- pattern already used for room photos. No existing column, table, RLS
-- policy or data is touched.

alter table rooms
  add column if not exists design_brief jsonb;

alter table design_concepts
  add column if not exists storage_path text;
