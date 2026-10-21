"use client";

import { useRef } from "react";
import { LogoMark } from "@/components/layout/logo";
import { SplitText } from "gsap/SplitText";
import { DUR, EASE, MOTION_OK, gsap, useGSAP } from "@/lib/motion";

gsap.registerPlugin(SplitText); // only the login stage uses it: keep it out of every other bundle

/** The sign-in stage: a navy room where the roof line draws and a slow blue glow breathes. */
export function LoginStage() {
  const root = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add(MOTION_OK, () => {
        const split = SplitText.create("[data-stage-title]", { type: "lines", mask: "lines", autoSplit: true });
        gsap
          .timeline({ defaults: { ease: EASE.expo } })
          .fromTo("[data-logo]", { clipPath: "inset(0 100% 0 0)" }, { clipPath: "inset(0 0% 0 0)", duration: 1.6, ease: "power2.inOut" })
          .from(split.lines, { yPercent: 105, duration: DUR.reveal + 0.3, stagger: 0.12 }, 0.5)
          .from("[data-stage-fade]", { autoAlpha: 0, y: 14, duration: DUR.reveal }, 1);
        gsap.to("[data-glow]", { scale: 1.12, opacity: 0.8, duration: 5, ease: "sine.inOut", repeat: -1, yoyo: true });
      });
      return () => mm.revert();
    },
    { scope: root }
  );

  return (
    <aside ref={root} className="surface-navy relative hidden overflow-hidden lg:flex lg:flex-col lg:justify-between lg:p-16">
      <div data-glow className="stage-glow pointer-events-none absolute -bottom-[30%] -left-[20%] size-[90vmin] opacity-55" aria-hidden />
      <div data-logo className="relative w-72"><LogoMark className="w-full bg-cream" /></div>
      <div className="relative">
        <h2 data-stage-title className="display display-lg max-w-[12ch]">
          Your space, <em>your story.</em>
        </h2>
        <p data-stage-fade className="label-caps mt-8 text-signal">
          InnerSpacio · Interior design studio
        </p>
      </div>
    </aside>
  );
}
