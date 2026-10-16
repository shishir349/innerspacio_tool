"use client";

import { useRef } from "react";
import { DUR, EASE, MOTION_OK, gsap, useGSAP } from "@/lib/motion";

/**
 * A generated render "develops": it wipes in left to right while resolving from a soft, desaturated
 * proof into full colour. Plays once on mount; reduced-motion users just get the image.
 */
export function Develop({ src, alt, className }: { src: string; alt: string; className?: string }) {
  const img = useRef<HTMLImageElement>(null);

  useGSAP(
    () => {
      const el = img.current;
      if (!el) return;
      const mm = gsap.matchMedia();
      mm.add(MOTION_OK, () => {
        gsap.fromTo(
          el,
          { clipPath: "inset(0 100% 0 0)", filter: "grayscale(1) blur(10px) brightness(1.1)", scale: 1.06 },
          {
            clipPath: "inset(0 0% 0 0)",
            filter: "grayscale(0) blur(0px) brightness(1)",
            scale: 1,
            duration: DUR.scene,
            ease: EASE.inOut,
            clearProps: "clipPath,filter,transform",
          }
        );
      });
      return () => mm.revert();
    },
    { dependencies: [src] }
  );

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img ref={img} src={src} alt={alt} className={className} />
  );
}
