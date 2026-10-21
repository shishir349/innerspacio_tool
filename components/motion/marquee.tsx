"use client";

import { useRef } from "react";
import { MOTION_OK, ScrollTrigger, gsap, useGSAP } from "@/lib/motion";

/**
 * A ticker of short Paceon phrases. It drifts on its own and the page's scroll velocity pushes it:
 * scroll down and it speeds up, scroll up and it reverses, then eases back. Under reduced motion it is a static row.
 */
export function Marquee({ items, className }: { items: string[]; className?: string }) {
  const track = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const el = track.current;
      if (!el) return;
      const mm = gsap.matchMedia();
      mm.add(MOTION_OK, () => {
        const tween = gsap.to(el, { xPercent: -50, duration: 38, ease: "none", repeat: -1 });
        const st = ScrollTrigger.create({
          trigger: el,
          start: "top bottom",
          end: "bottom top",
          onUpdate: (self) => {
            const v = gsap.utils.clamp(-8, 8, self.getVelocity() / 260);
            gsap.to(tween, { timeScale: 1 + Math.abs(v) * (self.direction === 1 ? 1 : -1) * 1.4, duration: 0.25, overwrite: true });
            gsap.to(tween, { timeScale: 1, duration: 1.1, delay: 0.25, ease: "power2.out", overwrite: "auto" });
          },
        });
        return () => st.kill();
      });
      return () => mm.revert();
    },
    { scope: track }
  );

  const row = [...items, ...items];
  return (
    <div aria-hidden className={`overflow-hidden whitespace-nowrap ${className ?? ""}`}>
      <div ref={track} className="flex w-max gap-12 will-change-transform">
        {[0, 1].map((k) => (
          <div key={k} className="flex shrink-0 gap-12">
            {row.map((t, i) => (
              <span key={i} className="font-heading text-[clamp(2.5rem,6vw,4.5rem)] leading-none uppercase">
                {t}
                <span className="mx-12 inline-block size-2 rounded-full bg-current align-middle opacity-60" />
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
