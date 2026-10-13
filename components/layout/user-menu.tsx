import { getCurrentUser } from "@/lib/auth";
import { signOutAction } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";

export async function UserMenu() {
  const user = await getCurrentUser();
  if (!user) return null;

  return (
    <div className="flex items-center justify-between gap-2 rounded-lg border border-border/60 bg-background/60 px-3 py-2">
      <p className="truncate text-xs text-muted-foreground" title={user.email ?? undefined}>
        {user.email}
      </p>
      <form action={signOutAction}>
        <Button type="submit" variant="ghost" size="icon-sm" title="Sign out">
          <LogOut className="size-3.5" />
        </Button>
      </form>
    </div>
  );
}
