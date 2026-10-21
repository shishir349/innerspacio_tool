"use client";

import { useRef } from "react";
import { ArrowDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Magnetic } from "@/components/motion/magnetic";
import { Marquee } from "@/components/motion/marquee";
import { SplitHeading } from "@/components/motion/split-heading";
import { scrollToId } from "@/components/motion/smooth-scroll";
import { EASE, MOTION_OK, gsap, useGSAP } from "@/lib/motion";

const ROOMS = ["Living", "Kitchen", "Bedroom", "Bathroom", "Dining", "Foyer", "Study"];

/** A plan drawn in royal linework: walls, partitions, door swings and dimension lines. Geometry only; no figures are claimed. */
function PlanDrawing() {
  const root = useRef<SVGSVGElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add(MOTION_OK, () => {
        const tl = gsap.timeline({ defaults: { ease: EASE.inOut } });
        tl.from("[data-wall]", { drawSVG: "0%", duration: 1.5, stagger: 0.12 }, 0.2)
          .from("[data-thin]", { drawSVG: "0%", duration: 1.1, stagger: 0.06 }, 0.9)
          .from("[data-dim]", { drawSVG: "50% 50%", duration: 1, stagger: 0.1 }, 1.3)
          .from("[data-room]", { autoAlpha: 0, y: 8, duration: 0.7, stagger: 0.09, ease: EASE.out }, 1.7);
        // Breathing: the plan drifts a few pixels so the hero is never quite still.
        gsap.to(root.current, { y: -10, duration: 4.5, ease: "sine.inOut", yoyo: true, repeat: -1 });
      });
      return () => mm.revert();
    },
    { scope: root }
  );

  return (
    <svg ref={root} viewBox="0 0 540 440" role="img" aria-label="Line drawing of a home floor plan" className="h-auto w-full text-royal">
      <g fill="none" stroke="currentColor" strokeLinecap="square" strokeLinejoin="miter">
        <g strokeWidth="6">
          <path data-wall d="M50 50 H490 V390 H50 Z" />
          <path data-wall d="M270 50 V260" />
          <path data-wall d="M270 260 H490" />
          <path data-wall d="M50 180 H270" />
          <path data-wall d="M380 260 V390" />
          <path data-wall d="M210 260 V390" />
        </g>
        <g strokeWidth="1.5" opacity="0.7">
          <path data-thin d="M270 120 A38 38 0 0 1 308 82" />
          <path data-thin d="M130 180 A40 40 0 0 0 170 220" />
          <path data-thin d="M210 345 A36 36 0 0 0 246 381" />
          <path data-thin d="M380 330 A38 38 0 0 0 342 292" />
          <path data-thin d="M490 140 V190 M486 140 V190" />
          <path data-thin d="M50 300 V350 M54 300 V350" />
          <path data-thin d="M70 400 H70" />
        </g>
        <g strokeWidth="1.5" opacity="0.55">
          <path data-dim d="M50 28 H490 M50 20 V36 M490 20 V36" />
          <path data-dim d="M514 50 V390 M506 50 H522 M506 390 H522" />
          <path data-dim d="M50 418 H380 M50 410 V426 M380 410 V426" />
        </g>
      </g>
      <g className="fill-royal font-heading" fontSize="30" textAnchor="middle" letterSpacing="1.5">
        <text data-room x="160" y="125">LIVING</text>
        <text data-room x="380" y="160">KITCHEN</text>
        <text data-room x="130" y="330">BEDROOM</text>
        <text data-room x="435" y="332">BATH</text>
        <text data-room x="295" y="330">DINING</text>
      </g>
    </svg>
  );
}

export function Hero() {
  return (
    <section className="relative isolate overflow-hidden">
      <div className="mx-auto grid min-h-[calc(100svh-72px-4.5rem)] max-w-[88rem] items-center gap-10 px-5 py-14 md:px-10 lg:grid-cols-[1.08fr_0.92fr] lg:gap-6">
        <div>
          <SplitHeading as="h1" scroll={false} className="display display-xl">
            Your space,
            <br />
            your <em>story</em>
          </SplitHeading>
          <p className="mt-7 max-w-md text-[1.1rem] text-ink-soft">
            Tell us about your home and see an indicative interior estimate, then AI concepts of your own rooms.
          </p>
          <div className="mt-9 flex flex-wrap items-center gap-5">
            <Magnetic>
              <Button size="lg" className="gap-3" onClick={() => scrollToId("estimate", -72)}>
                Start your estimate
                <ArrowDown className="size-5" />
              </Button>
            </Magnetic>
            <span className="text-[0.95rem] text-ink-soft">Free to try. No sign-up to start.</span>
          </div>
        </div>
        <div className="mx-auto w-full max-w-[34rem] lg:max-w-none">
          <PlanDrawing />
        </div>
      </div>
      <div className="surface-royal py-6">
        <Marquee items={ROOMS} />
      </div>
    </section>
  );
}
