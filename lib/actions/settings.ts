"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getRepository } from "@/lib/data";
import { requireUser, AuthError } from "@/lib/auth";
import type { ActionResult } from "@/lib/actions/projects";
import type { AppSettings } from "@/lib/types";

function fail(error: unknown): ActionResult<never> {
  if (error instanceof z.ZodError) {
    return { ok: false, error: error.issues.map((i) => i.message).join("; ") };
  }
  if (error instanceof AuthError) {
    return { ok: false, error: error.message };
  }
  return { ok: false, error: error instanceof Error ? error.message : "Something went wrong." };
}

const settingsSchema = z.object({
  targetGrossMarginPercent: z.coerce.number().min(0).max(99.99),
  defaultContingencyPercent: z.coerce.number().min(0).max(99.99),
  gstPercent: z.coerce.number().min(0).max(100),
});

export async function updateSettingsAction(
  input: z.infer<typeof settingsSchema>
): Promise<ActionResult<AppSettings>> {
  try {
    await requireUser();
    const parsed = settingsSchema.parse(input);
    const repo = await getRepository();
    const settings = await repo.updateSettings(parsed);
    revalidatePath("/settings");
    return { ok: true, data: settings };
  } catch (error) {
    return fail(error);
  }
}
