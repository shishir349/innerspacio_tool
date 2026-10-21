"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import Lenis from "lenis";
import "lenis/dist/lenis.css";
import { gsap, REDUCED, ScrollTrigger } from "@/lib/motion";

let active: Lenis | null = null;

/** Routes that must scroll natively (print layouts). */
const NATIVE = ["/boq-print"];

/** Inner scroll areas keep native wheel behaviour: dialogs, menus, selects, tables and anything marked data-lenis-prevent. */
const PREVENT =
  "[data-lenis-prevent],[role='dialog'],[role='listbox'],[role='menu'],[data-slot='select-content'],textarea,.overflow-auto,.overflow-y-auto,.overflow-x-auto,.overflow-scroll";

/** Smooth-scroll to an element id (falls back to native when Lenis is off, e.g. reduced motion). */
export function scrollToId(id: string, offset = 0) {
  const el = document.getElementById(id);
  if (!el) return;
  if (active) active.scrollTo(el, { offset, duration: 1.4 });
  else el.scrollIntoView({ behavior: "smooth", block: "start" });
}

/** The running Lenis instance (null under reduced motion or on native routes). */
export const getLenis = () => active;

/**
 * Lenis smooth scrolling for the whole site, driven by GSAP's ticker so ScrollTrigger and Lenis share one clock.
 * Mounted once in the root layout; a nested <SmoothScroll> is a pass-through. Inner scroll areas opt out
 * (PREVENT) so tables, dialogs and selects keep native behaviour. Skipped for reduced-motion users.
 */
export function SmoothScroll({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  useEffect(() => {
    if (active || window.matchMedia(REDUCED).matches) return;

    const lenis = new Lenis({
      lerp: 0.085,
      wheelMultiplier: 0.95,
      anchors: true,
      prevent: (node) => node.closest(PREVENT) !== null,
    });
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

  // New page: start at the top and let ScrollTrigger re-measure; print routes scroll natively.
  useEffect(() => {
    const l = active;
    if (!l) return;
    if (NATIVE.some((p) => pathname.startsWith(p))) l.stop();
    else l.start();
    l.scrollTo(0, { immediate: true, force: true });
    const t = window.setTimeout(() => ScrollTrigger.refresh(), 120);
    return () => window.clearTimeout(t);
  }, [pathname]);

  return <>{children}</>;
}
