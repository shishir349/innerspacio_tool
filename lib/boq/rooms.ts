import type { PlanRoom } from "@/lib/boq/brief";

export interface RoomIssue {
  id: string;
  kind: "missing" | "assumed" | "implausible" | "duplicate";
  message: string;
}

const MIN_FT = 2;
const MAX_FT = 60;

/** Checks on the plan read that the designer should look at before quantities are trusted. Pure; changes nothing. */
export function roomIssues(rooms: PlanRoom[]): RoomIssue[] {
  const out: RoomIssue[] = [];
  const seen = new Map<string, string>();
  for (const r of rooms) {
    if (!(r.l > 0) || !(r.b > 0)) {
      out.push({ id: r.id, kind: "missing", message: `${r.name}: length or breadth is missing — enter the size or the room's quantities cannot be measured.` });
      continue;
    }
    if (r.l < MIN_FT || r.b < MIN_FT || r.l > MAX_FT || r.b > MAX_FT) {
      out.push({ id: r.id, kind: "implausible", message: `${r.name}: ${r.l} × ${r.b} ft looks wrong — check the plan.` });
    }
    if (r.source === "assumed") {
      out.push({ id: r.id, kind: "assumed", message: `${r.name}: size is an assumption (not read from the plan) — confirm it.` });
    }
    const key = `${r.name.toLowerCase().replace(/\s+/g, " ").trim()}|${r.boqRoom}|${r.l}x${r.b}`;
    if (seen.has(key)) out.push({ id: r.id, kind: "duplicate", message: `${r.name}: looks like a duplicate of another room (same name, section and size).` });
    else seen.set(key, r.id);
  }
  return out;
}
