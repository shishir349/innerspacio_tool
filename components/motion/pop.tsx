"use client";

import { useRef } from "react";
import { EASE, MOTION_OK, gsap, useGSAP } from "@/lib/motion";

/** Springs its content in on mount. Re-key it (key={value}) to replay on change. */
export function Pop({
  children,
  className,
  from = 0.5,
}: {
  children: React.ReactNode;
  className?: string;
  from?: number;
}) {
  const ref = useRef<HTMLSpanElement>(null);

  useGSAP(
    () => {
      const el = ref.current;
      if (!el) return;
      const mm = gsap.matchMedia();
      mm.add(MOTION_OK, () => {
        gsap.from(el, {
          scale: from,
          autoAlpha: 0,
          duration: 0.45,
          ease: EASE.pop,
          clearProps: "transform,opacity,visibility",
        });
      });
      return () => mm.revert();
    },
    { scope: ref }
  );

  return (
    <span ref={ref} className={className ?? "inline-block"}>
      {children}
    </span>
  );
}
