"use client";

import { useRef, type ElementType } from "react";
import { EASE, MOTION_OK, SplitText, gsap, useGSAP } from "@/lib/motion";

type Tag = "h1" | "h2" | "h3" | "p" | "span" | "div";

/**
 * Display heading that rises line by line out of a mask. Above the fold it plays on load; below it, when it scrolls in.
 * The text is real DOM text (SplitText only wraps it), so SSR, search and screen readers get the plain heading,
 * and reduced-motion users never see the effect. `data-split` hides it until the split is ready (see globals.css fail-safe).
 */
export function SplitHeading({
  as = "h2",
  children,
  className,
  scroll = true,
  delay = 0,
  by = "lines",
}: {
  as?: Tag;
  children: React.ReactNode;
  className?: string;
  /** false = play immediately (hero). */
  scroll?: boolean;
  delay?: number;
  by?: "lines" | "words" | "chars";
}) {
  const ref = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const el = ref.current;
      if (!el) return;
      const mm = gsap.matchMedia();
      mm.add(MOTION_OK, () => {
        let split: SplitText | undefined;
        const run = () => {
          split = SplitText.create(el, {
            type: by === "chars" ? "lines,chars" : by === "words" ? "lines,words" : "lines",
            mask: "lines",
            linesClass: "split-line",
            autoSplit: true,
            onSplit: (self) => {
              el.setAttribute("data-split-ready", "");
              const targets = by === "chars" ? self.chars : by === "words" ? self.words : self.lines;
              return gsap.from(targets, {
                yPercent: 112,
                rotate: by === "chars" ? 4 : 0,
                duration: 1.05,
                ease: EASE.expo,
                stagger: by === "chars" ? 0.018 : by === "words" ? 0.05 : 0.11,
                delay,
                scrollTrigger: scroll ? { trigger: el, start: "top 88%", once: true } : undefined,
              });
            },
          });
        };
        // Wait for the display face so line breaks are measured with Paceon, not the fallback.
        document.fonts.ready.then(run);
        return () => split?.revert();
      });
      return () => mm.revert();
    },
    { scope: ref, dependencies: [by, scroll, delay] }
  );

  const Tag = as as ElementType;
  return (
    <Tag ref={ref} data-split="" className={className}>
      {children}
    </Tag>
  );
}
