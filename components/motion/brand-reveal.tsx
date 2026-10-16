"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { DUR, EASE, MOTION_OK, gsap, useGSAP } from "@/lib/motion";

/**
 * The opening moment of a client presentation: the roof line draws itself on a gold-lit stage, the
 * wordmark resolves, then the curtain lifts. Once per browser session; skipped for reduced motion.
 */
export function BrandReveal({ name }: { name?: string }) {
  const root = useRef<HTMLDivElement>(null);
  const [gone, setGone] = useState(true);

  useEffect(() => {
    try {
      if (sessionStorage.getItem("is-reveal") === "1") return;
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      sessionStorage.setItem("is-reveal", "1");
    } catch {
      /* storage blocked: just show it */
    }
    const t = setTimeout(() => setGone(false), 0);
    return () => clearTimeout(t);
  }, []);

  useGSAP(
    () => {
      if (gone || !root.current) return;
      const mm = gsap.matchMedia();
      mm.add(MOTION_OK, () => {
        document.documentElement.style.overflow = "hidden";
        const done = () => {
          document.documentElement.style.overflow = "";
          setGone(true);
        };
        gsap
          .timeline({ onComplete: done, defaults: { ease: EASE.expo } })
          .from("[data-glow]", { scale: 0.4, autoAlpha: 0, duration: 1.4 })
          .fromTo("[data-logo]", { clipPath: "inset(0 100% 0 0)", y: 16 }, { clipPath: "inset(0 0% 0 0)", y: 0, duration: 1.5, ease: "power2.inOut" }, 0.2)
          .from("[data-for]", { autoAlpha: 0, y: 10, duration: DUR.reveal }, 1.4)
          .to({}, { duration: 0.5 })
          .to(root.current, { yPercent: -100, duration: 1.1, ease: "expo.inOut" });
        return () => {
          document.documentElement.style.overflow = "";
        };
      });
      return () => mm.revert();
    },
    { scope: root, dependencies: [gone] }
  );

  if (gone) return null;
  return (
    <div ref={root} aria-hidden className="fixed inset-0 z-[100] grid place-items-center overflow-hidden bg-night text-[#f3efe6] print:hidden">
      <div data-glow className="stage-gold absolute size-[120vmax] opacity-60" />
      <div className="relative flex flex-col items-center">
        <div data-logo className="w-[min(30rem,80vw)]">
          <Image src="/logo.webp" alt="" width={890} height={260} priority className="h-auto w-full" />
        </div>
        {name && (
          <p data-for className="font-caps mt-8 text-[0.9rem] tracking-[0.18em] text-[#211812] uppercase">
            A design presentation for {name}
          </p>
        )}
      </div>
    </div>
  );
}
