"use client";

import { useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/projects", label: "Projects" },
  { href: "/design-studio", label: "Design Studio" },
  { href: "/boq", label: "BOQ" },
  { href: "/leads", label: "Leads" },
  { href: "/cost-catalogue", label: "Catalogue" },
  { href: "/settings", label: "Settings" },
] as const;

const isActive = (pathname: string, href: string) => pathname === href || pathname.startsWith(href + "/");

/** Top-bar navigation. The saffron dot glides (CSS transition, no JS animation) under whichever item is active. */
export function NavLinks({ orientation = "row", onNavigate }: { orientation?: "row" | "col"; onNavigate?: () => void }) {
  const pathname = usePathname();
  const root = useRef<HTMLElement>(null);
  const [dotX, setDotX] = useState<number | null>(null);

  useLayoutEffect(() => {
    if (orientation !== "row") return;
    const target = root.current?.querySelector<HTMLElement>("[data-active='true']");
    // Measuring the DOM after layout is exactly what this effect is for.
    setDotX(target ? target.offsetLeft + target.offsetWidth / 2 - 3 : null);
  }, [pathname, orientation]);

  return (
    <nav
      ref={root}
      className={cn("relative", orientation === "row" ? "flex items-center gap-1" : "flex flex-col gap-1")}
      aria-label="Main"
    >
      {NAV_ITEMS.map((item) => {
        const active = isActive(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            data-active={active}
            aria-current={active ? "page" : undefined}
            onClick={onNavigate}
            className={cn(
              "font-caps rounded-full text-[0.88rem] font-medium uppercase tracking-[0.08em] transition-colors duration-300",
              orientation === "row" ? "px-3.5 py-2" : "px-4 py-3 text-base",
              active ? "text-foreground" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {item.label}
          </Link>
        );
      })}
      {orientation === "row" && (
        <span
          aria-hidden
          className="pointer-events-none absolute -bottom-1.5 left-0 size-1.5 rounded-full bg-saffron transition-[transform,opacity] duration-500 ease-(--ease-out-expo)"
          style={{ transform: `translateX(${dotX ?? 0}px)`, opacity: dotX === null ? 0 : 1 }}
        />
      )}
    </nav>
  );
}
