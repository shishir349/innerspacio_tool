import { getCurrentUser } from "@/lib/auth";
import { signOutAction } from "@/lib/actions/auth";
import { LogOut } from "lucide-react";

/** Initial-in-a-circle with sign-out; the email sits in the tooltip. */
export async function UserMenu({ showEmail = false }: { showEmail?: boolean }) {
  const user = await getCurrentUser();
  if (!user) return null;
  const initial = (user.email ?? "?").charAt(0).toUpperCase();

  return (
    <form action={signOutAction} className="flex items-center gap-3">
      {showEmail && <p className="truncate text-sm text-muted-foreground">{user.email}</p>}
      <button
        type="submit"
        title={`Sign out${user.email ? ` (${user.email})` : ""}`}
        aria-label="Sign out"
        className="group/user relative inline-flex size-10 items-center justify-center rounded-full bg-foreground text-background transition-transform duration-300 ease-(--ease-out-expo) hover:scale-105"
      >
        <span className="font-caps text-sm transition-opacity group-hover/user:opacity-0">{initial}</span>
        <LogOut className="absolute size-4 opacity-0 transition-opacity group-hover/user:opacity-100" />
      </button>
    </form>
  );
}
