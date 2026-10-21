"use client";

import { useRef } from "react";
import { EASE, MOTION_OK, gsap, useGSAP } from "@/lib/motion";
import { formatLakh } from "@/lib/quote/format";

// Named formatters (not functions) so server components can pass the choice as a prop.
const FORMATTERS = {
  int: (n: number) => String(Math.round(n)),
  lakh: (n: number) => formatLakh(n),
  // Digits only: the caller draws the rupee sign and the L (Paceon has no rupee glyph).
  lakhNum: (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1)),
} as const;

/** Counts a number up from 0 when it scrolls into view. Final value is the SSR text, so no-JS/reduced-motion is correct. */
export function CountUp({
  value,
  format,
  duration = 1.4,
  className,
}: {
  value: number;
  format: keyof typeof FORMATTERS;
  duration?: number;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const fmt = FORMATTERS[format];

  useGSAP(
    () => {
      const el = ref.current;
      if (!el) return;
      const mm = gsap.matchMedia();
      mm.add(MOTION_OK, () => {
        const state = { v: 0 };
        el.textContent = fmt(0);
        gsap.to(state, {
          v: value,
          duration,
          ease: EASE.soft,
          snap: { v: format === "lakh" || format === "lakhNum" ? 0.5 : 1 },
          onUpdate: () => {
            el.textContent = fmt(state.v);
          },
          onComplete: () => {
            el.textContent = fmt(value);
          },
          scrollTrigger: { trigger: el, start: "top 92%", once: true },
        });
      });
      return () => mm.revert();
    },
    { scope: ref, dependencies: [value, format] }
  );

  return (
    <span ref={ref} className={className}>
      {fmt(value)}
    </span>
  );
}
