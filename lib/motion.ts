"use client";

import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";
import { DrawSVGPlugin } from "gsap/DrawSVGPlugin";
import { useGSAP } from "@gsap/react";

// One registration point so every motion component shares the same setup.
gsap.registerPlugin(ScrollTrigger, SplitText, DrawSVGPlugin, useGSAP);

/** Media queries for gsap.matchMedia — every animation must live under MOTION_OK. */
export const MOTION_OK = "(prefers-reduced-motion: no-preference)";
export const REDUCED = "(prefers-reduced-motion: reduce)";
/** Wide screens only: scroll-pinned scenes need room (and a mouse wheel). */
export const DESKTOP = "(min-width: 1024px)";
/** Fine pointers only: magnetic and cursor-follow effects mean nothing on touch. */
export const FINE_POINTER = "(hover: hover) and (pointer: fine)";

export const EASE = {
  out: "power3.out",
  soft: "power2.out",
  pop: "back.out(2.2)",
  expo: "expo.out",
  inOut: "expo.inOut",
  spring: "back.out(1.4)",
} as const;

/** Durations (s). Micro = feedback, ui = state change, reveal = entrances, scene = choreography. */
export const DUR = { micro: 0.15, ui: 0.3, reveal: 0.8, scene: 1.4 } as const;
export const STAGGER = { list: 0.05, words: 0.06, lines: 0.12 } as const;

export { gsap, ScrollTrigger, SplitText, DrawSVGPlugin, useGSAP };
