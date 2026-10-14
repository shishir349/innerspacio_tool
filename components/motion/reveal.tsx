"use client";

import { useRef } from "react";
import { EASE, MOTION_OK, gsap, useGSAP } from "@/lib/motion";

/**
 * Fades + lifts each direct child into view with a stagger, once, when the
 * wrapper scrolls into view. `immediate` plays on mount instead (above the fold).
 */
export function Reveal({
  children,
  className,
  stagger = 0.08,
  y = 24,
  immediate = false,
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  stagger?: number;
  y?: number;
  immediate?: boolean;
  delay?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const el = ref.current;
      if (!el || el.children.length === 0) return;
      const mm = gsap.matchMedia();
      mm.add(MOTION_OK, () => {
        gsap.from(el.children, {
          y,
          autoAlpha: 0,
          duration: 0.7,
          delay,
          ease: EASE.out,
          stagger,
          clearProps: "transform,opacity,visibility",
          scrollTrigger: immediate ? undefined : { trigger: el, start: "top 88%", once: true },
        });
      });
      return () => mm.revert();
    },
    { scope: ref }
  );

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
