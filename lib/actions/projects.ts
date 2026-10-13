"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getRepository } from "@/lib/data";
import { requireUser, AuthError } from "@/lib/auth";
import { uploadRoomPhoto, PhotoUploadError } from "@/lib/storage";
import type { Project, Room, RoomPhoto } from "@/lib/types";
import { ConceptImageUploadError } from "@/lib/storage";

export type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string };

function fail(error: unknown): ActionResult<never> {
  if (error instanceof z.ZodError) {
    return { ok: false, error: error.issues.map((i) => i.message).join("; ") };
  }
  if (error instanceof PhotoUploadError || error instanceof ConceptImageUploadError) {
    return { ok: false, error: error.message };
  }
  if (error instanceof AuthError) {
    return { ok: false, error: error.message };
  }
  return { ok: false, error: error instanceof Error ? error.message : "Something went wrong." };
}

const newProjectSchema = z.object({
  title: z.string().min(1, "Project title is required."),
  clientName: z.string().min(1, "Client name is required."),
  clientPhone: z.string().optional(),
  clientEmail: z.string().email("Enter a valid email address.").optional().or(z.literal("")),
  location: z.string().min(1, "Location is required."),
  budgetRangeMin: z.coerce.number().min(0).optional(),
  budgetRangeMax: z.coerce.number().min(0).optional(),
  designPreferences: z.string().optional(),
  notes: z.string().optional(),
});

export async function createProjectAction(
  input: z.infer<typeof newProjectSchema>
): Promise<ActionResult<Project>> {
  try {
    await requireUser();
    const parsed = newProjectSchema.parse(input);
    const repo = await getRepository();
    const project = await repo.createProject({
      ...parsed,
      clientEmail: parsed.clientEmail || undefined,
    });
    revalidatePath("/projects");
    revalidatePath("/dashboard");
    return { ok: true, data: project };
  } catch (error) {
    return fail(error);
  }
}

const updateProjectSchema = newProjectSchema.partial().extend({
  status: z
    .enum(["new", "in_progress", "concept_review", "estimate_ready", "completed", "on_hold"])
    .optional(),
});

export async function updateProjectAction(
  projectId: string,
  input: z.infer<typeof updateProjectSchema>
): Promise<ActionResult<Project>> {
  try {
    await requireUser();
    const parsed = updateProjectSchema.parse(input);
    const repo = await getRepository();
    const project = await repo.updateProject(projectId, {
      ...parsed,
      clientEmail: parsed.clientEmail || undefined,
    });
    revalidatePath(`/projects/${projectId}`);
    revalidatePath("/projects");
    revalidatePath("/dashboard");
    return { ok: true, data: project };
  } catch (error) {
    return fail(error);
  }
}

export async function deleteProjectAction(projectId: string): Promise<ActionResult<null>> {
  try {
    await requireUser();
    const repo = await getRepository();
    await repo.deleteProject(projectId);
    revalidatePath("/projects");
    revalidatePath("/dashboard");
    return { ok: true, data: null };
  } catch (error) {
    return fail(error);
  }
}

const newRoomSchema = z.object({
  name: z.string().min(1, "Room name is required."),
  type: z.enum([
    "living_room",
    "dining_room",
    "master_bedroom",
    "bedroom",
    "kids_bedroom",
    "kitchen",
    "bathroom",
    "study",
    "balcony",
    "entryway",
    "other",
  ]),
  length: z.coerce.number().min(0).optional(),
  width: z.coerce.number().min(0).optional(),
  ceilingHeight: z.coerce.number().min(0).optional(),
  unit: z.enum(["ft", "m"]).default("ft"),
  existingConditionNotes: z.string().optional(),
  preferredStyle: z.string().optional(),
  preferredColorPalette: z.string().optional(),
  storageRequirements: z.string().optional(),
  materialPreferences: z.string().optional(),
  budget: z.coerce.number().min(0).optional(),
  constraints: z.string().optional(),
});

export async function addRoomAction(
  projectId: string,
  input: z.infer<typeof newRoomSchema>
): Promise<ActionResult<Room>> {
  try {
    await requireUser();
    const parsed = newRoomSchema.parse(input);
    const repo = await getRepository();
    const room = await repo.addRoom(projectId, {
      name: parsed.name,
      type: parsed.type,
      dimensions: {
        length: parsed.length,
        width: parsed.width,
        ceilingHeight: parsed.ceilingHeight,
        unit: parsed.unit,
      },
      existingConditionNotes: parsed.existingConditionNotes,
      preferredStyle: parsed.preferredStyle,
      preferredColorPalette: parsed.preferredColorPalette,
      storageRequirements: parsed.storageRequirements,
      materialPreferences: parsed.materialPreferences,
      budget: parsed.budget,
      constraints: parsed.constraints,
    });
    revalidatePath(`/projects/${projectId}`);
    return { ok: true, data: room };
  } catch (error) {
    return fail(error);
  }
}

const updateRoomSchema = newRoomSchema.partial();

export async function updateRoomAction(
  projectId: string,
  roomId: string,
  input: z.infer<typeof updateRoomSchema>
): Promise<ActionResult<Room>> {
  try {
    await requireUser();
    const parsed = updateRoomSchema.parse(input);
    const repo = await getRepository();
    const existing = await repo.getProject(projectId);
    const existingRoom = existing?.rooms.find((r) => r.id === roomId);
    const room = await repo.updateRoom(projectId, roomId, {
      name: parsed.name,
      type: parsed.type,
      dimensions:
        parsed.length !== undefined || parsed.width !== undefined || parsed.ceilingHeight !== undefined || parsed.unit
          ? {
              length: parsed.length ?? existingRoom?.dimensions.length,
              width: parsed.width ?? existingRoom?.dimensions.width,
              ceilingHeight: parsed.ceilingHeight ?? existingRoom?.dimensions.ceilingHeight,
              unit: parsed.unit ?? existingRoom?.dimensions.unit ?? "ft",
            }
          : undefined,
      existingConditionNotes: parsed.existingConditionNotes,
      preferredStyle: parsed.preferredStyle,
      preferredColorPalette: parsed.preferredColorPalette,
      storageRequirements: parsed.storageRequirements,
      materialPreferences: parsed.materialPreferences,
      budget: parsed.budget,
      constraints: parsed.constraints,
    });
    revalidatePath(`/projects/${projectId}`);
    return { ok: true, data: room };
  } catch (error) {
    return fail(error);
  }
}

export async function deleteRoomAction(
  projectId: string,
  roomId: string
): Promise<ActionResult<null>> {
  try {
    await requireUser();
    const repo = await getRepository();
    await repo.deleteRoom(projectId, roomId);
    revalidatePath(`/projects/${projectId}`);
    return { ok: true, data: null };
  } catch (error) {
    return fail(error);
  }
}

export async function uploadRoomPhotoAction(
  projectId: string,
  roomId: string,
  formData: FormData
): Promise<ActionResult<RoomPhoto>> {
  try {
    await requireUser();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return { ok: false, error: "No file was provided." };
    }
    const uploaded = await uploadRoomPhoto(roomId, file);
    const repo = await getRepository();
    const photo = await repo.addRoomPhoto(projectId, roomId, {
      url: uploaded.url,
      storagePath: uploaded.storagePath,
      caption: (formData.get("caption") as string) || undefined,
      isPrimary: formData.get("isPrimary") === "true",
    });
    revalidatePath(`/projects/${projectId}`);
    return { ok: true, data: photo };
  } catch (error) {
    return fail(error);
  }
}

export async function removeRoomPhotoAction(
  projectId: string,
  roomId: string,
  photoId: string
): Promise<ActionResult<null>> {
  try {
    await requireUser();
    const repo = await getRepository();
    await repo.removeRoomPhoto(projectId, roomId, photoId);
    revalidatePath(`/projects/${projectId}`);
    return { ok: true, data: null };
  } catch (error) {
    return fail(error);
  }
}

export async function selectConceptAction(
  projectId: string,
  roomId: string,
  conceptId: string
): Promise<ActionResult<Room>> {
  try {
    await requireUser();
    const repo = await getRepository();
    const room = await repo.selectConcept(projectId, roomId, conceptId);
    revalidatePath(`/projects/${projectId}`);
    revalidatePath(`/design-studio/${projectId}/${roomId}`);
    return { ok: true, data: room };
  } catch (error) {
    return fail(error);
  }
}

export async function deleteConceptAction(
  projectId: string,
  roomId: string,
  conceptId: string
): Promise<ActionResult<Room>> {
  try {
    await requireUser();
    const repo = await getRepository();
    const room = await repo.deleteConcept(projectId, roomId, conceptId);
    revalidatePath(`/projects/${projectId}`);
    revalidatePath(`/design-studio/${projectId}/${roomId}`);
    return { ok: true, data: room };
  } catch (error) {
    return fail(error);
  }
}

const designBriefSchema = z.object({
  style: z.string().optional(),
  palette: z.string().optional(),
  mood: z.string().optional(),
  mustKeepFeatures: z.string().optional(),
  itemsToRemain: z.string().optional(),
  itemsToReplace: z.string().optional(),
  budgetRangeMin: z.coerce.number().min(0).optional(),
  budgetRangeMax: z.coerce.number().min(0).optional(),
  clientSpecificPreferences: z.string().optional(),
  freeTextInstructions: z.string().optional(),
  roomTypeDetails: z.record(z.string(), z.string()).optional(),
});

export async function saveDesignBriefAction(
  projectId: string,
  roomId: string,
  input: z.infer<typeof designBriefSchema>
): Promise<ActionResult<Room>> {
  try {
    await requireUser();
    const parsed = designBriefSchema.parse(input);
    const repo = await getRepository();
    const room = await repo.updateRoom(projectId, roomId, {
      preferredStyle: parsed.style,
      preferredColorPalette: parsed.palette,
      budget: parsed.budgetRangeMax ?? parsed.budgetRangeMin,
      designBrief: {
        mood: parsed.mood,
        mustKeepFeatures: parsed.mustKeepFeatures,
        itemsToRemain: parsed.itemsToRemain,
        itemsToReplace: parsed.itemsToReplace,
        clientSpecificPreferences: parsed.clientSpecificPreferences,
        freeTextInstructions: parsed.freeTextInstructions,
        roomTypeDetails: parsed.roomTypeDetails,
      },
    });
    revalidatePath(`/projects/${projectId}`);
    revalidatePath(`/design-studio/${projectId}/${roomId}`);
    return { ok: true, data: room };
  } catch (error) {
    return fail(error);
  }
}
