"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutGrid,
  FolderKanban,
  Sparkles,
  Receipt,
  Settings,
} from "lucide-react";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutGrid },
  { href: "/projects", label: "Projects", icon: FolderKanban },
  { href: "/design-studio", label: "Design Studio", icon: Sparkles },
  { href: "/cost-catalogue", label: "Cost Catalogue", icon: Receipt },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function NavLinks() {
  const pathname = usePathname();
  return (
    <nav className="flex flex-col gap-1">
      {NAV_ITEMS.map((item) => {
        const active = pathname === item.href || pathname.startsWith(item.href + "/");
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors",
              active
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-foreground/75 hover:bg-accent/60 hover:text-foreground"
            )}
          >
            <Icon className="size-4" strokeWidth={1.75} />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
