"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, CornerDownLeft, Search } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { NAV_ITEMS } from "@/components/layout/nav-links";

const ACTIONS = [
  { label: "New project", href: "/projects?new=1", hint: "Projects" },
  { label: "New BOQ", href: "/boq", hint: "BOQ" },
  { label: "Open leads inbox", href: "/leads", hint: "Leads" },
];

/** ⌘K / Ctrl+K jump menu: pages and quick actions. Keyboard first. */
export function CommandPalette({ trigger }: { trigger?: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [cursor, setCursor] = useState(0);
  const input = useRef<HTMLInputElement>(null);

  const items = useMemo(() => {
    const all = [
      ...ACTIONS,
      ...NAV_ITEMS.map((n) => ({ label: n.label, href: n.href as string, hint: "Go to" })),
    ];
    const t = q.trim().toLowerCase();
    return t ? all.filter((i) => i.label.toLowerCase().includes(t) || i.hint.toLowerCase().includes(t)) : all;
  }, [q]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const go = (href: string) => {
    setOpen(false);
    setQ("");
    router.push(href);
  };

  return (
    <>
      {trigger && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="font-caps hidden items-center gap-2 whitespace-nowrap rounded-md border border-primary/25 px-3 py-2 text-[0.75rem] font-semibold tracking-[0.12em] text-muted-foreground uppercase transition-colors hover:border-primary hover:text-primary lg:inline-flex"
          aria-label="Open command menu"
        >
          <Search className="size-3.5" /> Search
          <kbd className="rounded bg-accent px-1.5 py-0.5 text-[0.72rem] tracking-normal whitespace-nowrap text-accent-foreground">Ctrl K</kbd>
        </button>
      )}
      <Dialog
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (o) setCursor(0);
        }}
      >
        <DialogContent showCloseButton={false} className="top-[22%] translate-y-0 gap-0 p-0 sm:max-w-lg">
          <DialogTitle className="sr-only">Command menu</DialogTitle>
          <DialogDescription className="sr-only">Jump to a page or start something new.</DialogDescription>
          <div className="flex items-center gap-3 border-b border-border px-5">
            <Search className="size-4 text-muted-foreground" />
            <input
              ref={input}
              autoFocus
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setCursor(0);
              }}
              onKeyDown={(e) => {
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  setCursor((c) => Math.min(c + 1, items.length - 1));
                } else if (e.key === "ArrowUp") {
                  e.preventDefault();
                  setCursor((c) => Math.max(c - 1, 0));
                } else if (e.key === "Enter" && items[cursor]) {
                  e.preventDefault();
                  go(items[cursor].href);
                }
              }}
              placeholder="Go to, or start something…"
              className="h-14 w-full bg-transparent text-base outline-none placeholder:text-muted-foreground/70"
            />
          </div>
          <ul className="max-h-72 overflow-y-auto p-2" role="listbox">
            {items.length === 0 && <li className="px-4 py-6 text-center text-[0.95rem] text-muted-foreground">Nothing matches.</li>}
            {items.map((i, idx) => (
              <li key={i.label + i.href} role="option" aria-selected={idx === cursor}>
                <button
                  type="button"
                  onMouseEnter={() => setCursor(idx)}
                  onClick={() => go(i.href)}
                  className={`flex w-full items-center justify-between rounded-xl px-4 py-3 text-left transition-colors ${
                    idx === cursor ? "bg-secondary" : ""
                  }`}
                >
                  <span className="flex items-center gap-3">
                    <ArrowRight className="size-3.5 text-muted-foreground" />
                    {i.label}
                  </span>
                  <span className="font-caps flex items-center gap-2 text-[0.82rem] tracking-[0.12em] text-muted-foreground uppercase">
                    {i.hint}
                    {idx === cursor && <CornerDownLeft className="size-3" />}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </DialogContent>
      </Dialog>
    </>
  );
}
