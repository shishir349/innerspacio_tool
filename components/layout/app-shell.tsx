import Link from "next/link";
import { Plus } from "lucide-react";
import { Logo } from "@/components/layout/logo";
import { NavLinks } from "@/components/layout/nav-links";
import { UserMenu } from "@/components/layout/user-menu";
import { MobileNav } from "@/components/layout/mobile-nav";
import { CommandPalette } from "@/components/layout/command-palette";
import { RouteProgress } from "@/components/layout/route-progress";
import { ScrollProgress } from "@/components/motion/scroll-progress";
import { DemoModeBanner } from "@/components/shared/demo-mode-banner";
import { Button } from "@/components/ui/button";

/** Studio shell: a calm 72px top bar, then the work. Lenis scrolls the page; tables, dialogs and selects keep native inner scroll. */
export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen w-full flex-col bg-background">
      <RouteProgress />
      <ScrollProgress />
      <DemoModeBanner />
      <header className="sticky top-0 z-40 border-b border-border/70 bg-background/85 backdrop-blur-md">
        <div className="mx-auto flex h-[72px] w-full max-w-[96rem] items-center gap-6 px-4 md:px-8">
          <Link href="/dashboard" className="shrink-0" aria-label="InnerSpacio Studio home">
            <Logo size="sm" priority />
          </Link>
          <div className="mx-auto hidden lg:block">
            <NavLinks />
          </div>
          <div className="ml-auto flex items-center gap-3 lg:ml-0">
            <CommandPalette trigger />
            <Button render={<Link href="/projects?new=1" />} size="sm" className="hidden gap-1.5 sm:inline-flex">
              <Plus className="size-4" />
              New project
            </Button>
            <UserMenu />
            <MobileNav />
          </div>
        </div>
      </header>
      <main className="flex-1 px-4 py-8 md:px-8 md:py-12">
        <div className="mx-auto w-full max-w-[96rem]">
          {children}
        </div>
      </main>
    </div>
  );
}
