"use client";

import { useRef } from "react";
import { DUR, EASE, MOTION_OK, SplitText, gsap, useGSAP } from "@/lib/motion";

/** The sign-in stage: a gold-lit night room where the roof line draws and a slow glow breathes. */
export function LoginStage() {
  const root = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add(MOTION_OK, () => {
        const split = SplitText.create("[data-stage-title]", { type: "lines", mask: "lines", autoSplit: true });
        gsap
          .timeline({ defaults: { ease: EASE.expo } })
          .fromTo("[data-roof]", { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 1.8, ease: "power2.inOut" })
          .from(split.lines, { yPercent: 105, duration: DUR.reveal + 0.3, stagger: 0.12 }, 0.5)
          .from("[data-stage-fade]", { autoAlpha: 0, y: 14, duration: DUR.reveal }, 1);
        gsap.to("[data-glow]", { scale: 1.12, opacity: 0.8, duration: 5, ease: "sine.inOut", repeat: -1, yoyo: true });
      });
      return () => mm.revert();
    },
    { scope: root }
  );

  return (
    <aside ref={root} className="surface-night relative hidden overflow-hidden lg:flex lg:flex-col lg:justify-between lg:p-16">
      <div data-glow className="stage-gold pointer-events-none absolute -bottom-[30%] -left-[20%] size-[90vmin] opacity-55" aria-hidden />
      <svg viewBox="0 0 220 60" className="relative w-44 text-[#f3efe6]" aria-hidden>
        <path
          data-roof
          d="M10 56 L110 8 L210 56"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
          strokeLinejoin="round"
          pathLength={1}
          strokeDasharray="1"
        />
      </svg>
      <div className="relative">
        <h2 data-stage-title className="display display-lg max-w-[12ch]">
          Your space, <em>your story.</em>
        </h2>
        <p data-stage-fade className="font-caps mt-8 text-[0.82rem] tracking-[0.1em] text-[#d9b48a] uppercase">
          InnerSpacio · Interior design studio
        </p>
      </div>
    </aside>
  );
}
