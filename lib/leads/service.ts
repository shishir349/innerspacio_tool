import "server-only";
import { randomUUID } from "crypto";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { generateToken, hashToken } from "@/lib/presentation-links/crypto";
import { getImageGenerationProvider } from "@/lib/image-gen/provider";
import { buildConceptEditInstruction } from "@/lib/image-gen/prompt-builder";
import { refreshSignedPhotoUrl, validatePhotoFile, PhotoUploadError } from "@/lib/storage";
import {
  MAX_PHOTOS_PER_ROOM,
  QUOTE_ROOM_TYPES,
  TIER_INFO,
  type Bhk,
  type HomeSize,
  type PackageTier,
  type QuoteRoomType,
} from "@/lib/quote/constants";
import {
  estimateAllTiers,
  estimateForTier,
  explainEstimate,
  type QuoteBreakdown,
  type QuoteEstimateInput,
  type TierEstimate,
} from "@/lib/quote/estimate";
import type { DraftLeadInput, FinalizeLeadInput } from "@/lib/quote/schema";
import type { RoomType } from "@/lib/types";

/**
 * Public quote flow. This is the SECOND module in the running app allowed to
 * use the service-role client (the first is lib/presentation-links/token.ts).
 * Anonymous visitors have no Supabase session, so RLS cannot be satisfied for
 * them — instead every function here takes a lead resolved from a random
 * token (only its SHA-256 hash is stored) and scopes every query to that
 * lead's id. Never add a query here that isn't scoped to a resolved lead,
 * except `createDraft` (which creates one) and the global daily cost cap.
 */

export class LeadError extends Error {
  constructor(
    message: string,
    readonly code: "not_found" | "invalid" | "cap_reached" | "generation_failed"
  ) {
    super(message);
  }
}

const BUCKET = "room-photos";
const DEFAULT_DAILY_IMAGE_CAP = 100;

function db() {
  return createSupabaseAdminClient();
}

export interface LeadRow {
  id: string;
  name: string;
  city: string;
  bhk: Bhk;
  home_size: HomeSize | null;
  package_tier: PackageTier;
  estimate_low: number;
  estimate_high: number;
  status: "new" | "generated" | "consult_requested";
  consent_at: string;
  created_at: string;
}

// A draft lead has no personal details yet. The columns are NOT NULL, so a
// draft stores empty strings and this sentinel consent time until finalizeLead.
const DRAFT_CONSENT = "1970-01-01T00:00:00.000Z";

export function isFinalized(lead: Pick<LeadRow, "consent_at">): boolean {
  return new Date(lead.consent_at).getTime() > 0;
}

export interface LeadRoomRow {
  id: string;
  room_type: QuoteRoomType;
  label: string;
  ideas_text: string | null;
}

function roomLabel(type: string, index: number, totalOfType: number): string {
  const base = QUOTE_ROOM_TYPES.find((r) => r.value === type)?.label.replace(/ \(.*\)$/, "") ?? "Room";
  return totalOfType > 1 ? `${base} ${index}` : base;
}

function toEstimateInput(
  lead: Pick<LeadRow, "bhk" | "home_size" | "city">,
  rooms: Pick<LeadRoomRow, "room_type">[]
): QuoteEstimateInput {
  const counts: Partial<Record<QuoteRoomType, number>> = {};
  for (const r of rooms) counts[r.room_type] = (counts[r.room_type] ?? 0) + 1;
  return {
    bhk: lead.bhk,
    homeSize: lead.home_size ?? undefined,
    city: lead.city,
    rooms: counts,
  };
}

export async function createDraft(input: DraftLeadInput, ip: string) {
  const counts: Partial<Record<QuoteRoomType, number>> = {};
  for (const r of input.rooms) {
    const t = r.roomType as QuoteRoomType;
    counts[t] = (counts[t] ?? 0) + 1;
  }

  const token = generateToken();
  const client = db();

  const { data: lead, error } = await client
    .from("leads")
    .insert({
      name: "",
      email: "",
      phone: "",
      city: "",
      whatsapp_opt_in: false,
      bhk: input.bhk,
      home_size: input.homeSize ?? null,
      package_tier: input.packageTier,
      estimate_low: 0,
      estimate_high: 0,
      token_hash: hashToken(token),
      consent_at: DRAFT_CONSENT,
      ip_hash: hashToken(`ip:${ip}`),
    })
    .select("id")
    .single();
  if (error || !lead) throw new Error("Could not start your request. Please try again.");

  const seen: Record<string, number> = {};
  const rows = input.rooms.map((r) => {
    seen[r.roomType] = (seen[r.roomType] ?? 0) + 1;
    return {
      lead_id: lead.id,
      room_type: r.roomType,
      label: roomLabel(r.roomType, seen[r.roomType], counts[r.roomType as QuoteRoomType] ?? 1),
      ideas_text: r.ideas || null,
    };
  });
  const { data: rooms, error: roomsError } = await client
    .from("lead_rooms")
    .insert(rows)
    .select("id, room_type, label");
  if (roomsError || !rooms) {
    await client.from("leads").delete().eq("id", lead.id);
    throw new Error("Could not save your rooms. Please try again.");
  }

  return {
    leadId: lead.id as string,
    token,
    rooms: rooms.map((r) => ({ id: r.id as string, roomType: r.room_type as string, label: r.label as string })),
  };
}

/**
 * Attaches contact details + consent to a draft and computes the estimate.
 * The estimate is always computed here from the stored answers, never trusted
 * from the client. Safe to call twice (last write wins).
 */
export async function finalizeLead(lead: LeadRow, input: FinalizeLeadInput): Promise<TierEstimate> {
  const client = db();
  const { data: rooms } = await client.from("lead_rooms").select("room_type").eq("lead_id", lead.id);
  const estimate = estimateForTier(
    toEstimateInput({ bhk: lead.bhk, home_size: lead.home_size, city: input.city }, (rooms ?? []) as LeadRoomRow[]),
    lead.package_tier
  );
  const { error } = await client
    .from("leads")
    .update({
      name: input.name,
      email: input.email,
      phone: input.phone,
      whatsapp_opt_in: input.whatsappOptIn,
      city: input.city,
      estimate_low: estimate.lowLakh,
      estimate_high: estimate.highLakh,
      consent_at: new Date().toISOString(),
    })
    .eq("id", lead.id);
  if (error) throw new Error("Could not save your details. Please try again.");
  return estimate;
}

/** The ONLY way to get a lead from a token. Same generic miss for every failure. */
export async function resolveLead(token: string): Promise<LeadRow | null> {
  if (!token || token.length < 20 || token.length > 100) return null;
  const { data } = await db()
    .from("leads")
    .select("id, name, city, bhk, home_size, package_tier, estimate_low, estimate_high, status, consent_at, created_at")
    .eq("token_hash", hashToken(token))
    .maybeSingle();
  return (data as LeadRow | null) ?? null;
}

async function getLeadRoom(leadId: string, roomId: string): Promise<LeadRoomRow | null> {
  const { data } = await db()
    .from("lead_rooms")
    .select("id, room_type, label, ideas_text")
    .eq("id", roomId)
    .eq("lead_id", leadId)
    .maybeSingle();
  return (data as LeadRoomRow | null) ?? null;
}

async function dailyImagesUsed(): Promise<number> {
  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);
  const { count } = await db()
    .from("lead_concepts")
    .select("id", { count: "exact", head: true })
    .eq("is_demo", false)
    .gte("created_at", start.toISOString());
  return count ?? 0;
}

function extFor(type: string): string {
  if (type.includes("png")) return "png";
  if (type.includes("webp")) return "webp";
  if (type.includes("heic")) return "heic";
  return "jpg";
}

/**
 * Stores this room's photos and generates ONE concept image. Idempotent per
 * room: if a concept already exists it is returned instead of regenerating
 * (a retry after a network drop never double-charges).
 */
// ponytail: per-process map; a second instance could still double-generate (idempotency
// in processRoomOnce covers the finished case). Move to a DB status row if scaled out.
const inflight = new Map<string, Promise<Awaited<ReturnType<typeof processRoomOnce>>>>();

export function processRoom(lead: LeadRow, roomId: string, files: File[]) {
  const key = `${lead.id}:${roomId}`;
  const running = inflight.get(key);
  if (running) return running; // client retried while we're still generating: share the work
  const p = processRoomOnce(lead, roomId, files).finally(() => inflight.delete(key));
  inflight.set(key, p);
  return p;
}

async function processRoomOnce(lead: LeadRow, roomId: string, files: File[]) {
  const room = await getLeadRoom(lead.id, roomId);
  if (!room) throw new LeadError("Room not found.", "not_found");

  const client = db();
  const existing = await readConcept(lead.id, room.id);
  if (existing) return { roomId: room.id, concept: existing, reused: true };

  if (files.length === 0) throw new LeadError("Please add at least one photo of this room.", "invalid");
  if (files.length > MAX_PHOTOS_PER_ROOM) {
    throw new LeadError(`Please upload at most ${MAX_PHOTOS_PER_ROOM} photos per room.`, "invalid");
  }

  const cap = Number(process.env.QUOTE_DAILY_IMAGE_CAP) || DEFAULT_DAILY_IMAGE_CAP;
  const provider = getImageGenerationProvider();
  if (!provider.isDemo && (await dailyImagesUsed()) >= cap) {
    throw new LeadError(
      "We're getting a lot of requests today. Your estimate is saved — a designer will follow up with images.",
      "cap_reached"
    );
  }

  const photoPaths: string[] = [];
  for (const file of files) {
    const buffer = Buffer.from(await file.arrayBuffer());
    try {
      validatePhotoFile(file, buffer);
    } catch (e) {
      throw new LeadError(e instanceof PhotoUploadError ? e.message : "Invalid photo.", "invalid");
    }
    const path = `leads/${lead.id}/${room.id}/${randomUUID()}.${extFor(file.type)}`;
    const { error } = await client.storage.from(BUCKET).upload(path, buffer, { contentType: file.type });
    if (error) throw new Error("Could not upload your photo. Please try again.");
    photoPaths.push(path);
  }
  await client
    .from("lead_room_photos")
    .insert(photoPaths.map((storage_path) => ({ lead_room_id: room.id, storage_path })));

  const referenceUrl = await refreshSignedPhotoUrl(client, photoPaths[0]);
  if (!referenceUrl) throw new Error("Could not read your photo back. Please try again.");

  const instruction = buildConceptEditInstruction({
    roomType: room.room_type as RoomType,
    style: TIER_INFO[lead.package_tier].style,
    userBrief: room.ideas_text ?? "",
  });

  let generated;
  try {
    generated = await provider.generateConcepts({
      referencePhotoUrl: referenceUrl,
      roomName: room.label,
      roomType: room.label,
      style: TIER_INFO[lead.package_tier].style,
      brief: instruction,
      variantCount: 1,
    });
  } catch {
    throw new LeadError("We couldn't generate this image right now. Please retry.", "generation_failed");
  }
  const result = generated[0];
  if (!result) throw new LeadError("We couldn't generate this image right now. Please retry.", "generation_failed");

  let storagePath: string | null = null;
  let imageDataUrl: string | null = null;
  const decoded = /^data:([^;]+);base64,(.*)$/.exec(result.imageUrl);
  if (!provider.isDemo && decoded) {
    storagePath = `leads/${lead.id}/${room.id}/concept-${randomUUID()}.${extFor(decoded[1])}`;
    const { error } = await client.storage
      .from(BUCKET)
      .upload(storagePath, Buffer.from(decoded[2], "base64"), { contentType: decoded[1] });
    if (error) throw new Error("Could not save the generated image. Please retry.");
  } else {
    imageDataUrl = result.imageUrl; // demo placeholder (inline SVG)
  }

  await client.from("lead_concepts").insert({
    lead_room_id: room.id,
    storage_path: storagePath,
    image_data_url: imageDataUrl,
    provider: result.provider,
    is_demo: provider.isDemo,
  });

  const { count: roomCount } = await client
    .from("lead_rooms")
    .select("id", { count: "exact", head: true })
    .eq("lead_id", lead.id);
  const { data: doneRows } = await client
    .from("lead_concepts")
    .select("lead_room_id, lead_rooms!inner(lead_id)")
    .eq("lead_rooms.lead_id", lead.id);
  const done = new Set((doneRows ?? []).map((r) => r.lead_room_id as string)).size;
  if (roomCount && done >= roomCount) {
    await client.from("leads").update({ status: "generated" }).eq("id", lead.id).eq("status", "new");
  }

  const concept = await readConcept(lead.id, room.id);
  return { roomId: room.id, concept, reused: false };
}

export interface ConceptView {
  url: string;
  isDemo: boolean;
}

async function readConcept(leadId: string, roomId: string): Promise<ConceptView | null> {
  const client = db();
  const { data } = await client
    .from("lead_concepts")
    .select("storage_path, image_data_url, is_demo, lead_rooms!inner(lead_id)")
    .eq("lead_room_id", roomId)
    .eq("lead_rooms.lead_id", leadId)
    .order("created_at", { ascending: false })
    .limit(1);
  const row = data?.[0];
  if (!row) return null;
  if (row.storage_path) {
    const url = await refreshSignedPhotoUrl(client, row.storage_path as string);
    return url ? { url, isDemo: false } : null;
  }
  return row.image_data_url ? { url: row.image_data_url as string, isDemo: Boolean(row.is_demo) } : null;
}

export interface QuoteResult {
  name: string;
  city: string;
  selectedTier: PackageTier;
  estimate: { lowLakh: number; highLakh: number };
  tiers: TierEstimate[];
  breakdown: QuoteBreakdown;
  status: LeadRow["status"];
  rooms: {
    id: string;
    label: string;
    roomType: string;
    ideas: string | null;
    beforeUrl: string | null;
    concept: ConceptView | null;
  }[];
}

export async function getQuoteResult(lead: LeadRow): Promise<QuoteResult> {
  const client = db();
  const { data: rooms } = await client
    .from("lead_rooms")
    .select("id, room_type, label, ideas_text")
    .eq("lead_id", lead.id)
    .order("created_at", { ascending: true });
  const roomRows = (rooms ?? []) as LeadRoomRow[];

  const out: QuoteResult["rooms"] = [];
  for (const r of roomRows) {
    const { data: photos } = await client
      .from("lead_room_photos")
      .select("storage_path")
      .eq("lead_room_id", r.id)
      .order("created_at", { ascending: true })
      .limit(1);
    const path = photos?.[0]?.storage_path as string | undefined;
    out.push({
      id: r.id,
      label: r.label,
      roomType: r.room_type,
      ideas: r.ideas_text,
      beforeUrl: path ? await refreshSignedPhotoUrl(client, path) : null,
      concept: await readConcept(lead.id, r.id),
    });
  }

  const input = toEstimateInput(lead, roomRows);
  return {
    name: lead.name,
    city: lead.city,
    selectedTier: lead.package_tier,
    estimate: { lowLakh: Number(lead.estimate_low), highLakh: Number(lead.estimate_high) },
    tiers: estimateAllTiers(input),
    breakdown: explainEstimate(input, lead.package_tier),
    status: lead.status,
    rooms: out,
  };
}

export async function requestConsult(lead: LeadRow): Promise<void> {
  await db().from("leads").update({ status: "consult_requested" }).eq("id", lead.id);
}
