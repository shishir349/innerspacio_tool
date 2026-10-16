"use client";

import { useRef } from "react";
import { ArrowDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { scrollToId } from "@/components/motion/smooth-scroll";
import { DESKTOP, DUR, EASE, MOTION_OK, SplitText, STAGGER, gsap, useGSAP } from "@/lib/motion";

const STEPS = [
  { n: "01", title: "Tell us about your home", body: "BHK, the rooms you want redesigned and the package that fits." },
  { n: "02", title: "Show us each room", body: "One photo per room, plus what you picture: warm wood, more storage, a reading corner." },
  { n: "03", title: "See it designed", body: "An AI concept of every room, rendered in your space while you finish." },
  { n: "04", title: "Get your estimate", body: "An indicative range by trade and room, then a consultation with our design team." },
];

/** Showroom opening for /get-quote: headline, the pinned type scene, and the four-step promise. */
export function QuoteHero() {
  const root = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add(MOTION_OK, () => {
        // Headline: lines rise out of a mask, the italic word lands last.
        const split = SplitText.create("[data-hero-title]", { type: "lines", mask: "lines", autoSplit: true });
        gsap
          .timeline({ defaults: { ease: EASE.expo } })
          .from(split.lines, { yPercent: 105, duration: DUR.reveal + 0.3, stagger: STAGGER.lines }, 0.1)
          .from("[data-hero-fade]", { autoAlpha: 0, y: 18, duration: DUR.reveal, stagger: 0.1 }, 0.55)
          .from("[data-hero-rule]", { scaleX: 0, transformOrigin: "left", duration: 1.2 }, 0.4);

        // Material arches: entrance, a slow idle float, and parallax at three different speeds.
        gsap.from("[data-arch]", { yPercent: 18, autoAlpha: 0, duration: 1.4, ease: EASE.expo, stagger: 0.15, delay: 0.3 });
        gsap.utils.toArray<HTMLElement>("[data-arch]").forEach((el, i) => {
          gsap.to(el, { y: i % 2 ? 10 : -10, duration: 3.2 + i * 0.5, ease: "sine.inOut", repeat: -1, yoyo: true });
          gsap.to(el, {
            yPercent: -8 * (i + 1),
            ease: "none",
            scrollTrigger: { trigger: root.current, start: "top top", end: "bottom top", scrub: true },
          });
        });

        // Steps rise in as they scroll into view.
        gsap.from("[data-step]", {
          autoAlpha: 0,
          y: 36,
          duration: DUR.reveal,
          ease: EASE.out,
          stagger: 0.12,
          scrollTrigger: { trigger: "[data-steps]", start: "top 80%", once: true },
        });
      });

      // Pinned type scene (desktop, motion OK): the sentence slides while the stat card stays put.
      mm.add(`${MOTION_OK} and ${DESKTOP}`, () => {
        const track = root.current?.querySelector<HTMLElement>("[data-track]");
        if (!track) return;
        gsap.to(track, {
          x: () => -(track.scrollWidth - window.innerWidth + window.innerWidth * 0.1),
          ease: "none",
          scrollTrigger: {
            trigger: "[data-scene]",
            start: "top top",
            end: () => `+=${track.scrollWidth}`,
            pin: true,
            scrub: 0.8,
            invalidateOnRefresh: true,
          },
        });
        gsap.from("[data-stat]", {
          scale: 0.86,
          autoAlpha: 0,
          duration: 1,
          ease: EASE.spring,
          scrollTrigger: { trigger: "[data-scene]", start: "top 70%", once: true },
        });
      });
      return () => mm.revert();
    },
    { scope: root }
  );

  return (
    <div ref={root}>
      <section className="relative mx-auto flex min-h-[calc(100svh-72px)] max-w-[88rem] flex-col justify-center px-5 pt-10 pb-16 md:px-10">
        <div aria-hidden className="pointer-events-none absolute top-1/2 right-[4%] hidden h-[34rem] w-[36rem] -translate-y-1/2 lg:block">
          <div data-arch className="surface-olive absolute top-10 left-0 flex h-[26rem] w-52 flex-col justify-end rounded-t-full p-6">
            <span className="font-caps text-[0.65rem] tracking-[0.2em] uppercase opacity-80">Essential</span>
          </div>
          <div data-arch className="surface-terracotta absolute top-0 left-[11.5rem] flex h-[30rem] w-56 flex-col justify-end rounded-t-full p-6">
            <span className="font-caps text-[0.65rem] tracking-[0.2em] uppercase opacity-80">Premium</span>
          </div>
          <div data-arch className="surface-gold absolute top-16 left-[24rem] flex h-[24rem] w-48 flex-col justify-end rounded-t-full p-6">
            <span className="font-caps text-[0.65rem] tracking-[0.2em] uppercase opacity-80">Luxury</span>
          </div>
        </div>
        <p data-hero-fade className="eyebrow">Free estimate · about 3 minutes</p>
        <h1 data-hero-title className="display display-xl mt-6 max-w-[44rem]">
          From empty rooms to <em>extraordinary</em> spaces.
        </h1>
        <div data-hero-rule className="mt-10 h-px w-full max-w-md bg-foreground/30" />
        <div className="mt-8 flex flex-wrap items-center gap-x-10 gap-y-6">
          <p data-hero-fade className="max-w-md text-[1.05rem] text-muted-foreground">
            Upload a photo of each room, tell us what you picture, and see an AI design concept plus an indicative
            interior estimate, before you speak to anyone.
          </p>
          <Button data-hero-fade size="lg" className="gap-3" onClick={() => scrollToId("start", -24)}>
            Start your estimate <ArrowDown className="size-4" />
          </Button>
        </div>
      </section>

      <section data-scene className="relative overflow-hidden bg-background lg:h-svh">
        <div className="flex h-full flex-col justify-center py-24 lg:py-0">
          <div data-track className="flex w-max items-center gap-[6vw] px-5 md:px-10 lg:pl-[10vw]">
            <h2 className="display text-[clamp(3.5rem,13vw,13rem)] whitespace-nowrap">
              Rooms hold <em>memories</em>. Great design holds <em>lives</em> together.
            </h2>
          </div>
          <div
            data-stat
            className="surface-olive contact-shadow mx-auto mt-14 w-[min(20rem,86vw)] rounded-3xl p-7 lg:absolute lg:top-1/2 lg:left-1/2 lg:mt-0 lg:-translate-x-1/2 lg:-translate-y-1/2"
          >
            <p className="font-caps text-[0.7rem] tracking-[0.2em] uppercase opacity-80">Residential projects</p>
            <p className="display mt-10 text-7xl">25+</p>
            <p className="font-caps mt-4 border-t border-white/25 pt-4 text-[0.72rem] tracking-[0.14em] uppercase">
              Led by our in-house design team
            </p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[88rem] px-5 py-24 md:px-10 lg:py-36">
        <p className="eyebrow">How it works</p>
        <h2 className="display display-lg mt-5 max-w-[16ch]">
          Four steps, no <em>commitment.</em>
        </h2>
        <ol data-steps className="mt-16 grid gap-x-8 gap-y-12 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((s) => (
            <li key={s.n} data-step className="border-t border-foreground/25 pt-6">
              <span className="font-caps inline-grid size-11 place-items-center rounded-full bg-saffron text-[0.85rem] text-foreground">
                {s.n}
              </span>
              <h3 className="display mt-6 text-[1.7rem]">{s.title}</h3>
              <p className="mt-3 text-muted-foreground">{s.body}</p>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
