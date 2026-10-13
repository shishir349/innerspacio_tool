"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { isSupabaseConfigured } from "@/lib/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type SignInResult = { ok: true } | { ok: false; error: string };

const signInSchema = z.object({
  email: z.string().email("Enter a valid email address."),
  password: z.string().min(1, "Password is required."),
});

export async function signInAction(input: {
  email: string;
  password: string;
}): Promise<SignInResult> {
  if (!isSupabaseConfigured()) {
    return {
      ok: false,
      error: "Sign-in is unavailable: Supabase is not configured on this server.",
    };
  }

  const parsed = signInSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues.map((i) => i.message).join("; ") };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    // Never leak which half (email vs. password) was wrong.
    return { ok: false, error: "Invalid email or password." };
  }
  return { ok: true };
}

export async function signOutAction(): Promise<void> {
  if (isSupabaseConfigured()) {
    const supabase = await createSupabaseServerClient();
    await supabase.auth.signOut();
  }
  redirect("/login");
}
