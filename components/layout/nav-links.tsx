"use client";

import { useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { EASE, MOTION_OK, gsap, useGSAP } from "@/lib/motion";

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

/** Top-bar navigation. The saffron dot glides under whichever item is active. */
export function NavLinks({ orientation = "row", onNavigate }: { orientation?: "row" | "col"; onNavigate?: () => void }) {
  const pathname = usePathname();
  const root = useRef<HTMLElement>(null);
  const dot = useRef<HTMLSpanElement>(null);

  useGSAP(
    () => {
      const el = root.current;
      const d = dot.current;
      if (!el || !d || orientation !== "row") return;
      const target = el.querySelector<HTMLElement>("[data-active='true']");
      if (!target) {
        gsap.set(d, { autoAlpha: 0 });
        return;
      }
      const x = target.offsetLeft + target.offsetWidth / 2 - 3;
      const mm = gsap.matchMedia();
      mm.add(MOTION_OK, () => {
        gsap.to(d, { x, autoAlpha: 1, duration: 0.55, ease: EASE.expo });
      });
      mm.add("(prefers-reduced-motion: reduce)", () => {
        gsap.set(d, { x, autoAlpha: 1 });
      });
      return () => mm.revert();
    },
    { scope: root, dependencies: [pathname, orientation] }
  );

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
              "font-caps rounded-full text-[0.82rem] font-medium uppercase tracking-[0.12em] transition-colors duration-300",
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
          ref={dot}
          aria-hidden
          className="pointer-events-none absolute -bottom-1.5 left-0 size-1.5 rounded-full bg-saffron opacity-0"
        />
      )}
    </nav>
  );
}
