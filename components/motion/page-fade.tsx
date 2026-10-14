"use client";

import { useRef } from "react";
import { usePathname } from "next/navigation";
import { EASE, MOTION_OK, gsap, useGSAP } from "@/lib/motion";

/** Soft entrance for the signed-in app's main area on every route change. */
export function PageFade({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  useGSAP(
    () => {
      const el = ref.current;
      if (!el) return;
      const mm = gsap.matchMedia();
      mm.add(MOTION_OK, () => {
        gsap.fromTo(
          el,
          { autoAlpha: 0, y: 14 },
          { autoAlpha: 1, y: 0, duration: 0.5, ease: EASE.out, clearProps: "transform,opacity,visibility" }
        );
      });
      return () => mm.revert();
    },
    { scope: ref, dependencies: [pathname] }
  );

  return <div ref={ref}>{children}</div>;
}
