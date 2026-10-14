"use client";

import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";

// One registration point so every motion component shares the same setup.
gsap.registerPlugin(ScrollTrigger, useGSAP);

/** Media queries for gsap.matchMedia — every animation must live under MOTION_OK. */
export const MOTION_OK = "(prefers-reduced-motion: no-preference)";
export const REDUCED = "(prefers-reduced-motion: reduce)";

export const EASE = {
  out: "power3.out",
  soft: "power2.out",
  pop: "back.out(2.2)",
} as const;

export { gsap, ScrollTrigger, useGSAP };
