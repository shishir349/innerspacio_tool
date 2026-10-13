"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getRepository } from "@/lib/data";
import { requireUser, AuthError } from "@/lib/auth";
import type { NewCatalogueItemInput, UpdateCatalogueItemInput } from "@/lib/data/types";
import type { ActionResult } from "@/lib/actions/projects";
import type { CatalogueItem } from "@/lib/types";
import { CATALOGUE_CATEGORIES } from "@/lib/types";

function fail(error: unknown): ActionResult<never> {
  if (error instanceof z.ZodError) {
    return { ok: false, error: error.issues.map((i) => i.message).join("; ") };
  }
  if (error instanceof AuthError) {
    return { ok: false, error: error.message };
  }
  return { ok: false, error: error instanceof Error ? error.message : "Something went wrong." };
}

const categoryValues = CATALOGUE_CATEGORIES.map((c) => c.value) as [string, ...string[]];

const catalogueItemSchema = z.object({
  name: z.string().min(1, "Item name is required."),
  category: z.enum(categoryValues),
  unit: z.string().min(1, "Unit is required."),
  baseCostPerUnit: z.coerce.number().min(0, "Base cost must be zero or more."),
  defaultQuantity: z.coerce.number().min(0).optional(),
  sellingDescription: z.string().optional(),
  isActive: z.coerce.boolean().default(true),
});

export async function createCatalogueItemAction(
  input: z.infer<typeof catalogueItemSchema>
): Promise<ActionResult<CatalogueItem>> {
  try {
    await requireUser();
    const parsed = catalogueItemSchema.parse(input);
    const repo = await getRepository();
    const item = await repo.createCatalogueItem(parsed as NewCatalogueItemInput);
    revalidatePath("/cost-catalogue");
    return { ok: true, data: item };
  } catch (error) {
    return fail(error);
  }
}

const updateCatalogueItemSchema = catalogueItemSchema.partial();

export async function updateCatalogueItemAction(
  itemId: string,
  input: z.infer<typeof updateCatalogueItemSchema>
): Promise<ActionResult<CatalogueItem>> {
  try {
    await requireUser();
    const parsed = updateCatalogueItemSchema.parse(input);
    const repo = await getRepository();
    const item = await repo.updateCatalogueItem(itemId, parsed as UpdateCatalogueItemInput);
    revalidatePath("/cost-catalogue");
    return { ok: true, data: item };
  } catch (error) {
    return fail(error);
  }
}

export async function deleteCatalogueItemAction(itemId: string): Promise<ActionResult<null>> {
  try {
    await requireUser();
    const repo = await getRepository();
    await repo.deleteCatalogueItem(itemId);
    revalidatePath("/cost-catalogue");
    return { ok: true, data: null };
  } catch (error) {
    return fail(error);
  }
}
