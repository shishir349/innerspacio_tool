"use client";

import { useEffect } from "react";
import Lenis from "lenis";
import "lenis/dist/lenis.css";
import { gsap, REDUCED, ScrollTrigger } from "@/lib/motion";

let active: Lenis | null = null;

/** Smooth-scroll to an element id (falls back to native when Lenis is off, e.g. reduced motion). */
export function scrollToId(id: string, offset = 0) {
  const el = document.getElementById(id);
  if (!el) return;
  if (active) active.scrollTo(el, { offset, duration: 1.4 });
  else el.scrollIntoView({ behavior: "smooth", block: "start" });
}

/**
 * Lenis smooth scrolling, driven by GSAP's ticker so ScrollTrigger and Lenis
 * share one clock. Used on client-facing pages only: the staff app has
 * many nested scroll areas (dialogs, selects, tables) where Lenis fights native scroll.
 * Skipped entirely for reduced-motion users.
 */
export function SmoothScroll({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if (window.matchMedia(REDUCED).matches) return;

    const lenis = new Lenis({ lerp: 0.09, wheelMultiplier: 0.95 });
    active = lenis;
    lenis.on("scroll", ScrollTrigger.update);
    const tick = (time: number) => lenis.raf(time * 1000);
    gsap.ticker.add(tick);
    gsap.ticker.lagSmoothing(0);

    return () => {
      gsap.ticker.remove(tick);
      lenis.destroy();
      if (active === lenis) active = null;
    };
  }, []);

  return <>{children}</>;
}
