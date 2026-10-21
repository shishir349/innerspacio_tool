"use client";

import { useRef } from "react";
import { EASE, MOTION_OK, ScrollTrigger, gsap, useGSAP } from "@/lib/motion";

type Variant = "rise" | "wipe" | "fade" | "scale";

/**
 * Scroll entrance for a block or for the direct children of a grid / list (`stagger`).
 * rise = lift + fade, wipe = clip-path reveal (images, cards), fade, scale = settle from 0.94.
 * Content is visible by default; the from-state is applied by GSAP only under MOTION_OK, so
 * server HTML, no-JS and reduced-motion all show the finished page.
 */
export function ScrollReveal({
  children,
  className,
  variant = "rise",
  stagger = 0,
  delay = 0,
  start = "top 88%",
}: {
  children: React.ReactNode;
  className?: string;
  variant?: Variant;
  /** > 0 animates the direct children one after another instead of the wrapper. */
  stagger?: number;
  delay?: number;
  start?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const el = ref.current;
      if (!el) return;
      const mm = gsap.matchMedia();
      mm.add(MOTION_OK, () => {
        const targets = stagger > 0 ? Array.from(el.children) : [el];
        const from: gsap.TweenVars =
          variant === "wipe"
            ? { clipPath: "inset(0 0 100% 0)", yPercent: 6 }
            : variant === "fade"
              ? { autoAlpha: 0 }
              : variant === "scale"
                ? { autoAlpha: 0, scale: 0.94 }
                : { autoAlpha: 0, y: 36 };
        gsap.from(targets, {
          ...from,
          duration: variant === "wipe" ? 1.2 : 0.9,
          ease: EASE.expo,
          stagger,
          delay,
          clearProps: "transform,opacity,visibility,clipPath",
          scrollTrigger: { trigger: el, start, once: true },
        });
      });
      // Layout above may shift after fonts load.
      document.fonts.ready.then(() => ScrollTrigger.refresh());
      return () => mm.revert();
    },
    { scope: ref, dependencies: [variant, stagger, delay, start] }
  );

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
