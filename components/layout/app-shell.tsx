import Link from "next/link";
import { Logo } from "@/components/layout/logo";
import { NavLinks } from "@/components/layout/nav-links";
import { UserMenu } from "@/components/layout/user-menu";
import { PageFade } from "@/components/motion/page-fade";
import { DemoModeBanner } from "@/components/shared/demo-mode-banner";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen w-full bg-background">
      <aside className="hidden w-64 shrink-0 flex-col border-r border-border bg-sidebar px-4 py-6 md:flex">
        <Link href="/dashboard" className="mb-8 block px-1">
          <Logo />
        </Link>
        <NavLinks />
        <div className="mt-auto space-y-3 px-1 pt-6">
          <Button render={<Link href="/projects?new=1" />} size="sm" className="w-full gap-2">
            <Plus className="size-4" />
            New Project
          </Button>
          <UserMenu />
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            Your space, your story.
            <br />
            innerspacio.com
          </p>
        </div>
      </aside>
      <div className="flex min-h-screen flex-1 flex-col">
        <DemoModeBanner />
        <main className="flex-1 px-4 py-6 md:px-8 md:py-8">
          <div className="mx-auto w-full max-w-6xl">
            <PageFade>{children}</PageFade>
          </div>
        </main>
      </div>
    </div>
  );
}
