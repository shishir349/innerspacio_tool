"use client";

import { useRef } from "react";
import { EASE, MOTION_OK, gsap, useGSAP } from "@/lib/motion";

/**
 * A dimension line (hairline with end ticks, like a measured plan annotation) that draws left to right
 * when it enters the viewport. Purely decorative: aria-hidden.
 */
export function DrawLine({ className, label }: { className?: string; label?: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const el = ref.current;
      if (!el) return;
      const mm = gsap.matchMedia();
      mm.add(MOTION_OK, () => {
        gsap.from(el, {
          scaleX: 0,
          transformOrigin: "left center",
          duration: 1.4,
          ease: EASE.inOut,
          scrollTrigger: { trigger: el, start: "top 94%", once: true },
        });
        if (label) {
          gsap.from(el.querySelector("[data-dim-label]"), {
            autoAlpha: 0,
            y: 6,
            duration: 0.7,
            delay: 0.9,
            ease: EASE.out,
            scrollTrigger: { trigger: el, start: "top 94%", once: true },
          });
        }
      });
      return () => mm.revert();
    },
    { scope: ref }
  );

  return (
    <div aria-hidden className={`relative ${className ?? ""}`}>
      <div ref={ref} className="dim-line" />
      {label && (
        <span
          data-dim-label
          className="absolute left-1/2 -translate-x-1/2 -top-1 bg-background px-3 font-caps text-[0.7rem] font-semibold tracking-[0.14em] text-royal uppercase"
        >
          {label}
        </span>
      )}
    </div>
  );
}
