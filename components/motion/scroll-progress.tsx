"use client";

import { useRef } from "react";
import { MOTION_OK, gsap, useGSAP } from "@/lib/motion";

/** A royal hairline at the top of the viewport that fills as the page scrolls (scrubbed, so it follows Lenis exactly). */
export function ScrollProgress() {
  const bar = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    const mm = gsap.matchMedia();
    mm.add(MOTION_OK, () => {
      gsap.fromTo(
        bar.current,
        { scaleX: 0 },
        {
          scaleX: 1,
          ease: "none",
          transformOrigin: "left center",
          scrollTrigger: { start: 0, end: "max", scrub: 0.2 },
        }
      );
    });
    return () => mm.revert();
  });

  return (
    <div aria-hidden className="pointer-events-none fixed inset-x-0 top-0 z-[60] h-[3px] print:hidden">
      <div ref={bar} className="h-full origin-left scale-x-0 bg-royal" />
    </div>
  );
}
