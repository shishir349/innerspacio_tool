"use client";

import { useRef, useState } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Develop } from "@/components/motion/develop";

export interface SlideItem {
  key: string;
  label: string;
  state: "queued" | "run" | "done" | "fail";
  url?: string;
  isDemo?: boolean;
  msg?: string;
}

/**
 * Swipeable slider of per-room concepts. Rooms that are still generating show
 * a placeholder, so the visitor only finds out about progress when they reach
 * that slide. Native scroll-snap (touch/trackpad friendly) + arrows + dots.
 */
export function ConceptSlider({ items }: { items: SlideItem[] }) {
  const scroller = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);

  if (items.length === 0) return null;

  function go(i: number) {
    const el = scroller.current;
    if (!el) return;
    const clamped = Math.max(0, Math.min(items.length - 1, i));
    el.scrollTo({ left: clamped * el.clientWidth, behavior: "smooth" });
  }

  return (
    <div className="relative">
      <div
        ref={scroller}
        data-lenis-prevent
        onScroll={(e) => {
          const el = e.currentTarget;
          setActive(Math.round(el.scrollLeft / Math.max(1, el.clientWidth)));
        }}
        className="contact-shadow flex snap-x snap-mandatory overflow-x-auto rounded-3xl border border-border bg-card [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        aria-roledescription="carousel"
        aria-label="Your design concepts"
      >
        {items.map((it, i) => (
          <div
            key={it.key}
            className="relative aspect-[4/3] w-full shrink-0 snap-center"
            role="group"
            aria-roledescription="slide"
            aria-label={`${i + 1} of ${items.length}: ${it.label}`}
          >
            {it.state === "done" && it.url ? (
              <Develop src={it.url} alt={`${it.label} concept`} className="size-full object-cover" />
            ) : (
              <div className="flex size-full flex-col items-center justify-center gap-3 bg-sand/60 px-6 text-center">
                {it.state === "fail" ? (
                  <>
                    <X className="size-6 text-destructive" />
                    <p className="text-sm text-destructive">{it.msg ?? "We couldn't generate this image."}</p>
                    <p className="text-xs text-muted-foreground">Your estimate is still saved.</p>
                  </>
                ) : (
                  <>
                    <svg viewBox="0 0 160 60" className="w-28 text-foreground/70" aria-hidden>
                      <path d="M8 56 L80 8 L152 56" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" pathLength={1} strokeDasharray="1" strokeDashoffset="0">
                        {it.state === "run" && <animate attributeName="stroke-dashoffset" values="1;0;1" dur="2.4s" repeatCount="indefinite" />}
                      </path>
                    </svg>
                    <p className="display text-xl">
                      {it.state === "queued" ? "Waiting to start…" : "Designing this room…"}
                    </p>
                    <span className="h-px w-32 overflow-hidden bg-foreground/15" aria-hidden>
                      <span className={cn("block h-0.5 w-1/3 bg-saffron", it.state === "run" && "animate-[slide_1.4s_ease-in-out_infinite]")} />
                    </span>
                    <p className="text-xs text-muted-foreground">Usually under a minute.</p>
                  </>
                )}
              </div>
            )}
            <span className="font-caps absolute top-4 left-4 rounded-full bg-background/90 px-3.5 py-1.5 text-[0.7rem] tracking-[0.12em] uppercase">
              {it.label}
            </span>
            {it.state === "done" && (
              <span className="font-caps absolute right-4 bottom-4 rounded-full bg-background/90 px-3 py-1 text-[0.65rem] tracking-[0.12em] text-muted-foreground uppercase">
                {it.isDemo ? "Illustrative placeholder" : "AI concept"}
              </span>
            )}
          </div>
        ))}
      </div>

      {items.length > 1 && (
        <>
          <button
            type="button"
            aria-label="Previous room"
            onClick={() => go(active - 1)}
            disabled={active === 0}
            className="absolute top-1/2 left-2 grid size-9 -translate-y-1/2 place-items-center rounded-full bg-background/90 shadow disabled:opacity-0"
          >
            <ChevronLeft className="size-5" />
          </button>
          <button
            type="button"
            aria-label="Next room"
            onClick={() => go(active + 1)}
            disabled={active === items.length - 1}
            className="absolute top-1/2 right-2 grid size-9 -translate-y-1/2 place-items-center rounded-full bg-background/90 shadow disabled:opacity-0"
          >
            <ChevronRight className="size-5" />
          </button>
          <div className="mt-3 flex justify-center gap-1.5" aria-hidden>
            {items.map((it, i) => (
              <span
                key={it.key}
                className={cn(
                  "h-1.5 rounded-full transition-all duration-500",
                  i === active ? "w-6 bg-saffron" : "w-1.5 bg-foreground/20",
                  it.state === "done" && i !== active && "bg-primary/40"
                )}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
