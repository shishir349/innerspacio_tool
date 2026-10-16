"use client";

import { useRef } from "react";
import { Check } from "lucide-react";
import { CountUp } from "@/components/motion/count-up";
import { DUR, EASE, MOTION_OK, gsap, useGSAP } from "@/lib/motion";
import { TIER_INFO } from "@/lib/quote/constants";
import { formatLakh, formatRange } from "@/lib/quote/format";
import type { PackageTier } from "@/lib/quote/constants";
import type { QuoteBreakdown, TierEstimate } from "@/lib/quote/estimate";

export interface QuoteEstimate {
  estimate: TierEstimate;
  tiers: TierEstimate[];
  breakdown: QuoteBreakdown;
}

/**
 * The estimate tab: the range first, then where it comes from. The client-safe breakdown only
 * (trades, rooms, published rates). `progress` is the quiet "your rooms are being reimagined" line.
 */
export function EstimateView({
  quote,
  tier,
  progress,
}: {
  quote: QuoteEstimate;
  tier: PackageTier;
  progress?: { ready: number; total: number };
}) {
  const root = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add(MOTION_OK, () => {
        gsap.from("[data-range]", { autoAlpha: 0, y: 36, duration: 1.1, ease: EASE.expo });
        gsap.from("[data-rise]", { autoAlpha: 0, y: 24, duration: DUR.reveal, ease: EASE.out, stagger: 0.08, delay: 0.3 });
        gsap.utils.toArray<HTMLElement>("[data-bar]").forEach((el) => {
          gsap.from(el, { scaleX: 0, duration: 1.1, ease: EASE.expo, transformOrigin: "left center", delay: 0.5 });
        });
      });
      return () => mm.revert();
    },
    { scope: root }
  );

  const { estimate, tiers, breakdown } = quote;
  const pct = progress && progress.total > 0 ? Math.round((progress.ready / progress.total) * 100) : 0;

  return (
    <div ref={root}>
      <p className="eyebrow">{TIER_INFO[tier].label} package</p>
      <p data-range className="display mt-5 text-[clamp(3rem,10vw,6.5rem)] leading-[0.98] text-primary">
        <CountUp value={estimate.lowLakh} format="lakh" />
        <span className="mx-[0.1em] opacity-50">–</span>
        <CountUp value={estimate.highLakh} format="lakh" />
      </p>
      <p data-rise className="mt-5 max-w-lg text-[1.05rem] text-muted-foreground">
        An indicative range, not a final quote: built line by line from InnerSpacio&apos;s published rates, then
        tailored once a designer sees your space.
      </p>

      {progress && progress.total > 0 && (
        <div data-rise className="mt-8 rounded-2xl border border-border bg-card p-5">
          <div className="flex items-baseline justify-between gap-4">
            <p className="display text-[1.4rem]">
              {progress.ready >= progress.total ? "Your rooms are ready." : "Reimagining your rooms…"}
            </p>
            <p className="num text-[0.95rem] text-muted-foreground">
              {progress.ready} of {progress.total}
            </p>
          </div>
          <div className="mt-4 h-1 overflow-hidden rounded-full bg-sand">
            <div className="h-full rounded-full bg-saffron transition-[width] duration-700 ease-(--ease-out-expo)" style={{ width: `${pct}%` }} />
          </div>
        </div>
      )}

      <section data-rise className="mt-14">
        <p className="eyebrow">Where the money goes</p>
        <p className="mt-3 text-muted-foreground">
          About <span className="num">{formatLakh(breakdown.totalLakh)}</span> of work across {breakdown.byRoom.length} areas,
          with a range for site conditions and final choices.
        </p>
        <ul className="mt-6 divide-y divide-border">
          {breakdown.byTrade.map((t) => (
            <li key={t.label} className="py-4">
              <div className="flex items-baseline justify-between gap-4">
                <span className="display text-[1.3rem]">{t.label}</span>
                <span className="num text-muted-foreground">
                  {formatLakh(t.lakh)} · {t.pct}%
                </span>
              </div>
              <span className="mt-3 block h-px bg-border" aria-hidden>
                <span data-bar className="block h-0.5 origin-left bg-saffron" style={{ width: `${Math.max(3, t.pct)}%` }} />
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section data-rise className="mt-12 grid gap-10 sm:grid-cols-2">
        <div>
          <p className="eyebrow">By room</p>
          <ul className="mt-4 space-y-3">
            {breakdown.byRoom.map((r) => (
              <li key={r.label} className="flex justify-between gap-4 border-b border-border/70 pb-3">
                <span>{r.label}</span>
                <span className="num text-muted-foreground">{formatLakh(r.lakh)}</span>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="eyebrow">Compare packages</p>
          <ul className="mt-4 space-y-3">
            {tiers.map((t) => (
              <li
                key={t.tier}
                className={`flex items-center justify-between gap-4 rounded-xl border px-4 py-3 ${
                  t.tier === tier ? "border-foreground bg-secondary/70" : "border-border"
                }`}
              >
                <span className="flex items-center gap-2">
                  {t.tier === tier && <Check className="size-4" />}
                  {TIER_INFO[t.tier].label}
                </span>
                <span className="num">{formatRange(t)}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <ul data-rise className="mt-10 list-disc space-y-1 pl-5 text-[0.95rem] text-muted-foreground">
        {breakdown.assumptions.map((a) => (
          <li key={a}>{a}</li>
        ))}
      </ul>
    </div>
  );
}
