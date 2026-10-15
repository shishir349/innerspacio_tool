"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ensureLeadProject } from "@/lib/leads/project";

const leadId = z.string().uuid();

/** Staff: give a lead its project (if it has none yet) and open it. Session client + RLS, never service-role. */
export async function openLeadProjectAction(formData: FormData): Promise<void> {
  await requireUser();
  const id = leadId.parse(formData.get("leadId"));
  const supabase = await createSupabaseServerClient();
  const projectId = await ensureLeadProject(supabase, id);
  revalidatePath("/leads");
  revalidatePath("/projects");
  redirect(projectId ? `/projects/${projectId}` : "/leads");
}
