-- Seed data for local/dev Supabase projects.
-- Illustrative starting rates only — NOT verified vendor quotations. Edit via
-- the Cost Catalogue screen before relying on these in a real estimate.

-- ───────────────────────────── cost catalogue ───────────────────────────

insert into cost_catalogue_items (name, category, unit, base_cost_per_unit, default_quantity, selling_description, is_active) values ('Demolition of existing tiling', 'civil_demolition', 'sqft', 35, null, 'Careful removal and disposal of existing floor/wall tiles', true) on conflict do nothing;
insert into cost_catalogue_items (name, category, unit, base_cost_per_unit, default_quantity, selling_description, is_active) values ('Brick wall partition (4")', 'civil_demolition', 'sqft', 180, null, 'New partition wall in brick masonry', true) on conflict do nothing;
insert into cost_catalogue_items (name, category, unit, base_cost_per_unit, default_quantity, selling_description, is_active) values ('Debris removal & disposal', 'civil_demolition', 'trip', 2500, 1, null, true) on conflict do nothing;
insert into cost_catalogue_items (name, category, unit, base_cost_per_unit, default_quantity, selling_description, is_active) values ('Bathroom waterproofing (chemical)', 'waterproofing', 'sqft', 60, null, 'Two-coat chemical waterproofing with treatment at joints', true) on conflict do nothing;
insert into cost_catalogue_items (name, category, unit, base_cost_per_unit, default_quantity, selling_description, is_active) values ('Terrace / balcony waterproofing', 'waterproofing', 'sqft', 85, null, null, true) on conflict do nothing;
insert into cost_catalogue_items (name, category, unit, base_cost_per_unit, default_quantity, selling_description, is_active) values ('CPVC water line re-routing', 'plumbing', 'point', 1800, null, 'Per fixture point, concealed piping', true) on conflict do nothing;
insert into cost_catalogue_items (name, category, unit, base_cost_per_unit, default_quantity, selling_description, is_active) values ('Drainage line relocation', 'plumbing', 'point', 2800, null, null, true) on conflict do nothing;
insert into cost_catalogue_items (name, category, unit, base_cost_per_unit, default_quantity, selling_description, is_active) values ('Geyser point plumbing', 'plumbing', 'point', 1500, 1, null, true) on conflict do nothing;
insert into cost_catalogue_items (name, category, unit, base_cost_per_unit, default_quantity, selling_description, is_active) values ('Light point wiring (concealed)', 'electrical', 'point', 950, null, null, true) on conflict do nothing;
insert into cost_catalogue_items (name, category, unit, base_cost_per_unit, default_quantity, selling_description, is_active) values ('Switchboard & modular switches', 'electrical', 'point', 1200, null, null, true) on conflict do nothing;
insert into cost_catalogue_items (name, category, unit, base_cost_per_unit, default_quantity, selling_description, is_active) values ('AC point wiring with dedicated MCB', 'electrical', 'point', 3200, null, null, true) on conflict do nothing;
insert into cost_catalogue_items (name, category, unit, base_cost_per_unit, default_quantity, selling_description, is_active) values ('Exhaust fan point', 'electrical', 'point', 850, null, null, true) on conflict do nothing;
insert into cost_catalogue_items (name, category, unit, base_cost_per_unit, default_quantity, selling_description, is_active) values ('Vitrified floor tiling (2x2 ft)', 'tiling_stone', 'sqft', 110, null, 'Branded vitrified tile, mid-range', true) on conflict do nothing;
insert into cost_catalogue_items (name, category, unit, base_cost_per_unit, default_quantity, selling_description, is_active) values ('Anti-skid bathroom floor tiling', 'tiling_stone', 'sqft', 95, null, null, true) on conflict do nothing;
insert into cost_catalogue_items (name, category, unit, base_cost_per_unit, default_quantity, selling_description, is_active) values ('Wall tiling (ceramic, up to 7 ft)', 'tiling_stone', 'sqft', 105, null, null, true) on conflict do nothing;
insert into cost_catalogue_items (name, category, unit, base_cost_per_unit, default_quantity, selling_description, is_active) values ('Kitchen countertop — quartz', 'tiling_stone', 'sqft', 420, null, 'Engineered quartz, mid-range finish', true) on conflict do nothing;
insert into cost_catalogue_items (name, category, unit, base_cost_per_unit, default_quantity, selling_description, is_active) values ('Wall-hung WC with concealed tank', 'sanitaryware', 'set', 22000, 1, null, true) on conflict do nothing;
insert into cost_catalogue_items (name, category, unit, base_cost_per_unit, default_quantity, selling_description, is_active) values ('Wash basin with counter', 'sanitaryware', 'set', 14000, 1, null, true) on conflict do nothing;
insert into cost_catalogue_items (name, category, unit, base_cost_per_unit, default_quantity, selling_description, is_active) values ('Shower partition (glass)', 'sanitaryware', 'sqft', 650, null, null, true) on conflict do nothing;
insert into cost_catalogue_items (name, category, unit, base_cost_per_unit, default_quantity, selling_description, is_active) values ('Health faucet & bib cock set', 'sanitaryware', 'set', 3200, 1, null, true) on conflict do nothing;
insert into cost_catalogue_items (name, category, unit, base_cost_per_unit, default_quantity, selling_description, is_active) values ('Bed with storage (queen, laminate)', 'carpentry_modular', 'unit', 48000, 1, null, true) on conflict do nothing;
insert into cost_catalogue_items (name, category, unit, base_cost_per_unit, default_quantity, selling_description, is_active) values ('Modular kitchen base + wall units', 'carpentry_modular', 'running ft', 2800, null, null, true) on conflict do nothing;
insert into cost_catalogue_items (name, category, unit, base_cost_per_unit, default_quantity, selling_description, is_active) values ('Study table with drawers', 'carpentry_modular', 'unit', 18000, null, null, true) on conflict do nothing;
insert into cost_catalogue_items (name, category, unit, base_cost_per_unit, default_quantity, selling_description, is_active) values ('TV unit with storage', 'carpentry_modular', 'running ft', 3200, null, null, true) on conflict do nothing;
insert into cost_catalogue_items (name, category, unit, base_cost_per_unit, default_quantity, selling_description, is_active) values ('Sliding-door wardrobe (laminate finish)', 'wardrobes_storage', 'sqft', 1650, null, 'Shutter + internal organisers, laminate finish', true) on conflict do nothing;
insert into cost_catalogue_items (name, category, unit, base_cost_per_unit, default_quantity, selling_description, is_active) values ('Loft storage above wardrobe', 'wardrobes_storage', 'sqft', 950, null, null, true) on conflict do nothing;
insert into cost_catalogue_items (name, category, unit, base_cost_per_unit, default_quantity, selling_description, is_active) values ('Open bookshelf / display unit', 'wardrobes_storage', 'sqft', 1100, null, null, true) on conflict do nothing;
insert into cost_catalogue_items (name, category, unit, base_cost_per_unit, default_quantity, selling_description, is_active) values ('Wall putty + premium emulsion paint', 'painting_finishes', 'sqft', 28, null, null, true) on conflict do nothing;
insert into cost_catalogue_items (name, category, unit, base_cost_per_unit, default_quantity, selling_description, is_active) values ('Textured accent wall finish', 'painting_finishes', 'sqft', 65, null, null, true) on conflict do nothing;
insert into cost_catalogue_items (name, category, unit, base_cost_per_unit, default_quantity, selling_description, is_active) values ('Wallpaper (imported, mid-range)', 'painting_finishes', 'sqft', 140, null, null, true) on conflict do nothing;
insert into cost_catalogue_items (name, category, unit, base_cost_per_unit, default_quantity, selling_description, is_active) values ('Cove lighting (LED strip, concealed)', 'lighting', 'running ft', 420, null, null, true) on conflict do nothing;
insert into cost_catalogue_items (name, category, unit, base_cost_per_unit, default_quantity, selling_description, is_active) values ('Decorative pendant light', 'lighting', 'unit', 6500, null, null, true) on conflict do nothing;
insert into cost_catalogue_items (name, category, unit, base_cost_per_unit, default_quantity, selling_description, is_active) values ('Recessed spotlight (COB LED)', 'lighting', 'unit', 950, null, null, true) on conflict do nothing;
insert into cost_catalogue_items (name, category, unit, base_cost_per_unit, default_quantity, selling_description, is_active) values ('Gypsum false ceiling (plain)', 'false_ceiling', 'sqft', 85, null, null, true) on conflict do nothing;
insert into cost_catalogue_items (name, category, unit, base_cost_per_unit, default_quantity, selling_description, is_active) values ('Gypsum false ceiling with cove detail', 'false_ceiling', 'sqft', 120, null, null, true) on conflict do nothing;
insert into cost_catalogue_items (name, category, unit, base_cost_per_unit, default_quantity, selling_description, is_active) values ('Soft-close hinges & channels (per door)', 'hardware', 'door', 850, null, null, true) on conflict do nothing;
insert into cost_catalogue_items (name, category, unit, base_cost_per_unit, default_quantity, selling_description, is_active) values ('Cabinet handles & knobs (per unit)', 'hardware', 'unit', 180, null, null, true) on conflict do nothing;
insert into cost_catalogue_items (name, category, unit, base_cost_per_unit, default_quantity, selling_description, is_active) values ('Mirror with LED backlight', 'glass_mirrors', 'sqft', 480, null, null, true) on conflict do nothing;
insert into cost_catalogue_items (name, category, unit, base_cost_per_unit, default_quantity, selling_description, is_active) values ('Toughened glass partition', 'glass_mirrors', 'sqft', 720, null, null, true) on conflict do nothing;
insert into cost_catalogue_items (name, category, unit, base_cost_per_unit, default_quantity, selling_description, is_active) values ('Mason & helper labour (daily)', 'labour', 'day', 1800, null, null, true) on conflict do nothing;
insert into cost_catalogue_items (name, category, unit, base_cost_per_unit, default_quantity, selling_description, is_active) values ('Carpenter labour (daily)', 'labour', 'day', 2200, null, null, true) on conflict do nothing;
insert into cost_catalogue_items (name, category, unit, base_cost_per_unit, default_quantity, selling_description, is_active) values ('Painter labour (daily)', 'labour', 'day', 1500, null, null, true) on conflict do nothing;
insert into cost_catalogue_items (name, category, unit, base_cost_per_unit, default_quantity, selling_description, is_active) values ('Design consultation & 3D visualisation', 'design_pm', 'room', 15000, null, 'Covers concept design, revisions and 3D views', true) on conflict do nothing;
insert into cost_catalogue_items (name, category, unit, base_cost_per_unit, default_quantity, selling_description, is_active) values ('Site supervision & project management', 'design_pm', 'project', 35000, 1, null, true) on conflict do nothing;
insert into cost_catalogue_items (name, category, unit, base_cost_per_unit, default_quantity, selling_description, is_active) values ('Transport & logistics', 'miscellaneous', 'trip', 2000, null, null, true) on conflict do nothing;
insert into cost_catalogue_items (name, category, unit, base_cost_per_unit, default_quantity, selling_description, is_active) values ('Site protection & cleaning', 'miscellaneous', 'project', 5000, 1, null, true) on conflict do nothing;

-- ───────────────────────────── sample projects ──────────────────────────
-- Mirrors the in-app demo-mode sample data so the meeting workflow can be
-- tested the same way whether or not Supabase is configured.

do $$
declare
  v_project_id uuid;
  v_kids_room_id uuid;
  v_master_bath_id uuid;
  v_guest_bath_id uuid;
begin
  insert into projects (title, client_name, client_phone, client_email, location, status, budget_range_min, budget_range_max, design_preferences, notes)
  values (
    'Sharma Residence — Full Home Refresh', 'Rohit & Anjali Sharma', '+91 98765 43210', 'rohit.sharma@example.com',
    'Sector 50, Noida', 'in_progress', 700000, 1000000,
    'Warm, family-friendly, low-maintenance materials',
    'Client prefers weekend site visits. Kids currently sharing a temporary room.'
  )
  returning id into v_project_id;

  insert into rooms (project_id, name, type, dimension_length, dimension_width, dimension_ceiling_height, dimension_unit, existing_condition_notes, preferred_style, preferred_color_palette, storage_requirements, material_preferences, budget, constraints)
  values (
    v_project_id, 'Kids'' Bedroom', 'kids_bedroom', 11, 10, 9.5, 'ft',
    'Existing bunk bed to be removed. Walls have minor dampness near the window.',
    'Playful modern, pastel tones', 'Soft blue, mint green, white',
    'Toy storage, study table with drawers, wardrobe for two children',
    'Low-VOC paint, scratch-resistant laminate', 350000,
    'One window with AC unit already installed — avoid relocating it.'
  )
  returning id into v_kids_room_id;

  insert into rooms (project_id, name, type, dimension_length, dimension_width, dimension_ceiling_height, dimension_unit, existing_condition_notes, preferred_style, preferred_color_palette, storage_requirements, material_preferences, budget, constraints)
  values (
    v_project_id, 'Master Bathroom', 'bathroom', 8, 6, 9, 'ft',
    'Old ceramic tiles, visible grout discoloration, functioning plumbing.',
    'Spa-like minimal', 'Warm grey, matte black fixtures',
    'Mirror cabinet, under-counter storage', 'Anti-skid tiles, quartz counter', 280000,
    'Concealed plumbing condition unknown — flag for site inspection.'
  )
  returning id into v_master_bath_id;

  insert into rooms (project_id, name, type, dimension_length, dimension_width, dimension_ceiling_height, dimension_unit, existing_condition_notes, preferred_style, preferred_color_palette, storage_requirements, material_preferences, budget, constraints)
  values (
    v_project_id, 'Guest Bathroom', 'bathroom', 7, 5, 9, 'ft',
    'Compact layout, older fittings, no natural ventilation.',
    'Clean contemporary', 'White, light beige',
    'Compact wall-mounted storage', 'Budget-friendly tiles, standard sanitaryware', 180000,
    'No window — exhaust fan is essential.'
  )
  returning id into v_guest_bath_id;

  insert into projects (title, client_name, client_phone, client_email, location, status, budget_range_min, budget_range_max, design_preferences, notes)
  values (
    'Verma Apartment — Living Room Makeover', 'Priya Verma', '+91 91234 56789', 'priya.verma@example.com',
    'DLF Phase 3, Gurugram', 'new', 300000, 450000,
    'Minimal, lots of natural light, neutral palette', ''
  );
end $$;
