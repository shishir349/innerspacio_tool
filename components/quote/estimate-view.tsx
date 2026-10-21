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

/** Paceon has no rupee glyph: the sign is drawn in the working face, scaled and raised like a currency superscript. */
function Rupee() {
  return <span aria-label="rupees" className="mr-[0.05em] align-[0.5em] font-sans text-[0.5em] font-medium">₹</span>;
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
      <p data-range className="display text-[clamp(3.5rem,13vw,6rem)] leading-[0.95] text-primary">
        <Rupee />
        <CountUp value={estimate.lowLakh} format="lakhNum" />L
        <span aria-hidden className="mx-[0.22em] inline-block h-[0.07em] w-[0.5em] bg-current align-middle opacity-60" />
        <span className="sr-only"> to </span>
        <Rupee />
        <CountUp value={estimate.highLakh} format="lakhNum" />L
      </p>
      <p data-rise className="label-caps mt-4 text-ink-soft">{TIER_INFO[tier].label} package</p>
      <p data-rise className="mt-4 max-w-lg text-[1.05rem] text-muted-foreground">
        An indicative range, not a final quote: built line by line from InnerSpacio&apos;s published rates, then
        tailored once a designer sees your space.
      </p>

      {progress && progress.total > 0 && (
        <div data-rise className="mt-8 rounded-2xl border border-border bg-card p-5">
          <div className="flex items-baseline justify-between gap-4">
            <p className="display text-[1.8rem]">
              {progress.ready >= progress.total ? "Your rooms are ready." : "Reimagining your rooms…"}
            </p>
            <p className="num text-[0.95rem] text-muted-foreground">
              {progress.ready} of {progress.total}
            </p>
          </div>
          <div className="mt-4 h-1 overflow-hidden rounded-full bg-mist">
            <div className="h-full rounded-full bg-royal transition-[width] duration-700 ease-(--ease-out-expo)" style={{ width: `${pct}%` }} />
          </div>
        </div>
      )}

      <section data-rise className="mt-14">
        <h2 className="display text-[2.25rem]">Where the money goes</h2>
        <p className="mt-3 text-muted-foreground">
          About <span className="num">{formatLakh(breakdown.totalLakh)}</span> of work across {breakdown.byRoom.length} areas,
          with a range for site conditions and final choices.
        </p>
        <ul className="mt-6 divide-y divide-border">
          {breakdown.byTrade.map((t) => (
            <li key={t.label} className="py-4">
              <div className="flex items-baseline justify-between gap-4">
                <span className="display text-[1.7rem]">{t.label}</span>
                <span className="num text-muted-foreground">
                  {formatLakh(t.lakh)} · {t.pct}%
                </span>
              </div>
              <span className="mt-3 block h-px bg-border" aria-hidden>
                <span data-bar className="block h-0.5 origin-left bg-royal" style={{ width: `${Math.max(3, t.pct)}%` }} />
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section data-rise className="mt-12 grid gap-10 sm:grid-cols-2">
        <div>
          <h2 className="display text-[2.25rem]">By room</h2>
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
          <h2 className="display text-[2.25rem]">Compare packages</h2>
          <ul className="mt-4 space-y-3">
            {tiers.map((t) => (
              <li
                key={t.tier}
                className={`flex items-center justify-between gap-4 rounded-xl border px-4 py-3 ${
                  t.tier === tier ? "border-primary bg-accent text-accent-foreground" : "border-border"
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
