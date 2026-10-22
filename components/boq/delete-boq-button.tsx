"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";

/** Permanently deletes one saved BOQ after a confirm, then refreshes the list. */
export function DeleteBoqButton({ projectId, boqId, title }: { projectId: string; boqId: string; title: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function remove() {
    if (!window.confirm(`Permanently delete “${title}”? This cannot be undone.`)) return;
    setBusy(true);
    try {
      const r = await fetch("/api/boq/delete", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ projectId, boqId }) });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error ?? "Could not delete the BOQ.");
      toast.success("BOQ deleted.");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not delete the BOQ.");
      setBusy(false);
    }
  }
  return (
    <button type="button" onClick={remove} disabled={busy} aria-label={`Delete ${title}`} className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-navy disabled:opacity-50">
      {busy ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
    </button>
  );
}
