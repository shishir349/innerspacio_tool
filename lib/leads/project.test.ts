import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ensureLeadProject } from "@/lib/leads/project";

type Row = Record<string, unknown>;

/** Just enough of the PostgREST builder for ensureLeadProject, over in-memory tables. */
function fake(tables: Record<string, Row[]>) {
  let seq = 0;
  const from = (name: string) => {
    const rows = (tables[name] ??= []);
    const filters: ((r: Row) => boolean)[] = [];
    let patch: Row | null = null;
    let inserted: Row[] | null = null;
    let del = false;
    const run = () => {
      const hit = rows.filter((r) => filters.every((f) => f(r)));
      if (patch) hit.forEach((r) => Object.assign(r, patch));
      if (del) tables[name] = rows.filter((r) => !hit.includes(r));
      return hit;
    };
    const b: Record<string, unknown> = {
      select: () => b,
      eq: (k: string, v: unknown) => (filters.push((r) => r[k] === v), b),
      is: (k: string, v: unknown) => (filters.push((r) => (r[k] ?? null) === v), b),
      order: () => b,
      insert: (v: Row | Row[]) => {
        inserted = (Array.isArray(v) ? v : [v]).map((x) => ({ id: `id-${++seq}`, ...x }));
        rows.push(...inserted);
        return b;
      },
      update: (v: Row) => ((patch = v), b),
      delete: () => ((del = true), b),
      maybeSingle: async () => ({ data: run()[0] ?? null, error: null }),
      single: async () => ({ data: (inserted ?? run())[0] ?? null, error: null }),
      then: (res: (v: { data: Row[]; error: null }) => unknown) => res({ data: inserted ?? run(), error: null }),
    };
    return b;
  };
  return { from } as unknown as SupabaseClient;
}

const lead = (p: Row = {}): Row => ({
  id: "L1", name: "Asha", email: "a@x.in", phone: "999", city: "Noida", bhk: "3",
  package_tier: "premium", project_id: null, consent_at: "2026-10-01T00:00:00Z", ...p,
});

describe("ensureLeadProject", () => {
  it("creates a project with the lead's rooms and links it", async () => {
    const t: Record<string, Row[]> = {
      leads: [lead()],
      lead_rooms: [
        { lead_id: "L1", label: "Living Room", room_type: "living_room", ideas_text: "warm" },
        { lead_id: "L1", label: "Bedroom 1", room_type: "bedroom", ideas_text: null },
      ],
    };
    const id = await ensureLeadProject(fake(t), "L1");
    expect(id).toBeTruthy();
    expect(t.projects).toHaveLength(1);
    expect(t.projects[0]).toMatchObject({ client_name: "Asha", location: "Noida", client_phone: "999" });
    expect(t.rooms.map((r) => r.name)).toEqual(["Living Room", "Bedroom 1"]);
    expect(t.rooms.every((r) => r.project_id === id)).toBe(true);
    expect(t.leads[0].project_id).toBe(id);
  });

  it("is idempotent: a linked lead gets the same project, nothing new", async () => {
    const t: Record<string, Row[]> = { leads: [lead({ project_id: "P9" })] };
    expect(await ensureLeadProject(fake(t), "L1")).toBe("P9");
    expect(t.projects ?? []).toHaveLength(0);
  });

  it("ignores a draft (no consent / contact yet) and a missing lead", async () => {
    const draft: Record<string, Row[]> = { leads: [lead({ name: "", consent_at: "1970-01-01T00:00:00.000Z" })] };
    expect(await ensureLeadProject(fake(draft), "L1")).toBeNull();
    expect(draft.projects ?? []).toHaveLength(0);
    expect(await ensureLeadProject(fake({ leads: [] }), "nope")).toBeNull();
  });
});
