"use client";

import { useRef } from "react";
import { DESKTOP, MOTION_OK, gsap, useGSAP } from "@/lib/motion";

/**
 * Scroll-scrubbed parallax: the child drifts `speed` of its own height against the scroll while the frame clips it.
 * Wrap an image (it is scaled up a touch so the drift never shows an edge) or a decorative layer.
 */
export function Parallax({
  children,
  speed = 0.12,
  className,
  scale = 1.14,
}: {
  children: React.ReactNode;
  speed?: number;
  className?: string;
  scale?: number;
}) {
  const frame = useRef<HTMLDivElement>(null);
  const layer = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add(`${MOTION_OK} and ${DESKTOP}`, () => {
        gsap.fromTo(
          layer.current,
          { yPercent: -speed * 100, scale },
          {
            yPercent: speed * 100,
            scale,
            ease: "none",
            scrollTrigger: { trigger: frame.current, start: "top bottom", end: "bottom top", scrub: true },
          }
        );
      });
      return () => mm.revert();
    },
    { scope: frame, dependencies: [speed, scale] }
  );

  return (
    <div ref={frame} className={`overflow-hidden ${className ?? ""}`}>
      <div ref={layer} className="size-full will-change-transform">
        {children}
      </div>
    </div>
  );
}
