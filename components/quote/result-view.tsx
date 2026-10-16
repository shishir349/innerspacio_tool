"use client";

import { useRef, useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BeforeAfterSlider } from "@/components/present/before-after-slider";
import { CountUp } from "@/components/motion/count-up";
import { DUR, EASE, MOTION_OK, SplitText, gsap, useGSAP } from "@/lib/motion";
import { TIER_INFO } from "@/lib/quote/constants";
import { formatLakh, formatRange } from "@/lib/quote/format";
import type { QuoteResult } from "@/lib/leads/service";

/** The client's result: a typographic range first, then each room as a spread, then the ledger. */
export function QuoteResultView({ result, token }: { result: QuoteResult; token: string }) {
  const [consult, setConsult] = useState(result.status === "consult_requested");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const tier = TIER_INFO[result.selectedTier];
  const root = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add(MOTION_OK, () => {
        const split = SplitText.create("[data-result-title]", { type: "lines", mask: "lines", autoSplit: true });
        gsap
          .timeline({ defaults: { ease: EASE.expo } })
          .from(split.lines, { yPercent: 105, duration: DUR.reveal + 0.3, stagger: 0.12 })
          .from("[data-range]", { autoAlpha: 0, y: 40, duration: 1.1 }, 0.35)
          .from("[data-result-fade]", { autoAlpha: 0, y: 16, duration: DUR.reveal, stagger: 0.1 }, 0.7);

        gsap.utils.toArray<HTMLElement>("[data-wipe]").forEach((el) => {
          gsap.fromTo(
            el,
            { clipPath: "inset(0 100% 0 0 round 24px)" },
            {
              clipPath: "inset(0 0% 0 0 round 24px)",
              duration: 1.3,
              ease: EASE.inOut,
              clearProps: "clipPath",
              scrollTrigger: { trigger: el, start: "top 85%", once: true },
            }
          );
        });
        gsap.utils.toArray<HTMLElement>("[data-rise]").forEach((el) => {
          gsap.from(el, {
            y: 40,
            autoAlpha: 0,
            duration: DUR.reveal,
            ease: EASE.out,
            scrollTrigger: { trigger: el, start: "top 88%", once: true },
          });
        });
        gsap.utils.toArray<HTMLElement>("[data-bar]").forEach((el) => {
          gsap.from(el, {
            scaleX: 0,
            duration: 1.1,
            ease: EASE.expo,
            transformOrigin: "left center",
            scrollTrigger: { trigger: el, start: "top 95%", once: true },
          });
        });
      });
      return () => mm.revert();
    },
    { scope: root }
  );

  async function requestConsult() {
    setBusy(true);
    setErr(null);
    try {
      const r = await fetch("/api/public/quote/consult", { method: "POST", headers: { "x-quote-token": token } });
      if (!r.ok) throw new Error();
      setConsult(true);
    } catch {
      setErr("Could not send your request. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div ref={root} className="min-h-screen bg-background">
      <main>
        {/* 1. The number */}
        <section className="mx-auto max-w-[88rem] px-5 pt-16 pb-24 md:px-10 lg:pt-24">
          <p data-result-fade className="eyebrow">
            {result.name.split(" ")[0]}, your estimate · {tier.label} package
          </p>
          <h1 data-result-title className="display display-md mt-6 max-w-[20ch]">
            Your home, designed, and what it would <em>take.</em>
          </h1>
          <p data-range className="display mt-12 text-[clamp(3.25rem,10.5vw,10rem)] leading-[0.95] text-primary">
            <CountUp value={result.estimate.lowLakh} format="lakh" />
            <span className="mx-[0.12em] opacity-50">–</span>
            <CountUp value={result.estimate.highLakh} format="lakh" />
          </p>
          <p data-result-fade className="mt-8 max-w-xl text-muted-foreground">
            An indicative range, not a final quote. It is built line by line from InnerSpacio&apos;s published
            rates and tailored once a designer sees your space.
          </p>
        </section>

        {/* 2. Rooms as spreads */}
        <section aria-labelledby="designs" className="mx-auto max-w-[88rem] px-5 md:px-10">
          <p className="eyebrow">Your design concepts</p>
          <h2 id="designs" className="sr-only">
            Your design concepts
          </h2>
          <div className="mt-10 space-y-20 lg:space-y-28">
            {result.rooms.map((r, i) => (
              <article key={r.id} className="grid items-end gap-8 lg:grid-cols-12">
                <div data-rise className={`lg:col-span-4 ${i % 2 ? "lg:order-2" : ""}`}>
                  <p className="font-caps text-[0.75rem] tracking-[0.18em] text-muted-foreground">
                    {String(i + 1).padStart(2, "0")} / {String(result.rooms.length).padStart(2, "0")}
                  </p>
                  <h3 className="display display-md mt-3">{r.label}</h3>
                  {r.ideas && <p className="mt-5 text-muted-foreground">&ldquo;{r.ideas}&rdquo;</p>}
                </div>
                <div className={`lg:col-span-8 ${i % 2 ? "lg:order-1" : ""}`}>
                  {r.concept && r.beforeUrl ? (
                    <div data-wipe className="contact-shadow overflow-hidden rounded-3xl">
                      <BeforeAfterSlider
                        beforeSrc={r.beforeUrl}
                        afterSrc={r.concept.url}
                        afterLabel={r.concept.isDemo ? "Illustrative placeholder" : "AI concept"}
                      />
                    </div>
                  ) : (
                    <p className="rounded-3xl border border-dashed border-border p-10 text-muted-foreground">
                      Your image for this room isn&apos;t ready yet — a designer will share it with you.
                    </p>
                  )}
                </div>
              </article>
            ))}
          </div>
          <p className="mt-10 max-w-xl text-sm text-muted-foreground">
            Images are AI-generated concepts for inspiration. Final design depends on a site visit and measurements.
          </p>
        </section>

        {/* 3. The ledger */}
        <section aria-labelledby="basis" className="mx-auto mt-32 max-w-[88rem] px-5 md:px-10">
          <p className="eyebrow">How we got this number</p>
          <h2 id="basis" className="display display-lg mt-5 max-w-[18ch]">
            Built line by line, <em>not guessed.</em>
          </h2>
          <p className="mt-6 max-w-xl text-muted-foreground">
            About <span className="num">{formatLakh(result.breakdown.totalLakh)}</span> of work across{" "}
            {result.breakdown.byRoom.length} areas, with a range for site conditions and final choices.
          </p>

          <div className="mt-14 grid gap-12 lg:grid-cols-12">
            <div className="lg:col-span-7">
              <h3 className="font-caps text-[0.75rem] tracking-[0.18em] text-muted-foreground uppercase">Where the money goes</h3>
              <ul className="mt-6 divide-y divide-border">
                {result.breakdown.byTrade.map((t) => (
                  <li key={t.label} data-rise className="py-5">
                    <div className="flex items-baseline justify-between gap-4">
                      <span className="display text-[1.5rem]">{t.label}</span>
                      <span className="num text-muted-foreground">
                        {formatLakh(t.lakh)} · {t.pct}%
                      </span>
                    </div>
                    <span className="mt-3 block h-px bg-border" aria-hidden>
                      <span
                        data-bar
                        className="block h-0.5 origin-left bg-saffron"
                        style={{ width: `${Math.max(3, t.pct)}%` }}
                      />
                    </span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="space-y-10 lg:col-span-5">
              <div>
                <h3 className="font-caps text-[0.75rem] tracking-[0.18em] text-muted-foreground uppercase">By room</h3>
                <ul className="mt-5 space-y-3">
                  {result.breakdown.byRoom.map((r) => (
                    <li key={r.label} className="flex justify-between gap-4 border-b border-border/70 pb-3">
                      <span>{r.label}</span>
                      <span className="num text-muted-foreground">{formatLakh(r.lakh)}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h3 className="font-caps text-[0.75rem] tracking-[0.18em] text-muted-foreground uppercase">Biggest items</h3>
                <ul className="mt-5 space-y-3 text-[0.95rem]">
                  {result.breakdown.highlights.map((h, i) => (
                    <li key={i}>
                      <span className="text-muted-foreground">{h.room}: </span>
                      {h.text}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          <ul className="mt-10 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
            {result.breakdown.assumptions.map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
        </section>

        {/* 4. Compare */}
        <section aria-labelledby="compare" className="mx-auto mt-32 max-w-[88rem] px-5 md:px-10">
          <p className="eyebrow">Compare packages</p>
          <h2 id="compare" className="sr-only">
            Compare packages
          </h2>
          <ul className="mt-8 grid gap-4 md:grid-cols-3">
            {result.tiers.map((t) => {
              const on = t.tier === result.selectedTier;
              const world = t.tier === "essential" ? "bg-sand" : t.tier === "premium" ? "surface-olive" : "surface-terracotta";
              return (
                <li
                  key={t.tier}
                  data-rise
                  className={`relative rounded-3xl p-7 ${world} ${on ? "ring-2 ring-saffron ring-offset-4 ring-offset-background" : ""}`}
                >
                  <span className="flex items-center gap-2">
                    {on && <Check className="size-4" />}
                    <span className="display text-[1.9rem]">{TIER_INFO[t.tier].label}</span>
                  </span>
                  <span className="num mt-6 block text-xl">{formatRange(t)}</span>
                  <span className="mt-6 block h-px bg-current/25" aria-hidden>
                    <span
                      data-bar
                      className="block h-0.5 origin-left bg-saffron"
                      style={{ width: `${Math.max(6, Math.min(100, (t.highLakh / 90) * 100))}%` }}
                    />
                  </span>
                </li>
              );
            })}
          </ul>
        </section>

        {/* 5. Consult */}
        <section className="surface-night mt-32">
          <div className="mx-auto max-w-[88rem] px-5 py-24 text-center md:px-10 lg:py-36">
            <p className="eyebrow justify-center text-[#d9b48a]">Next step</p>
            <h2 data-rise className="display display-lg mx-auto mt-6 max-w-[18ch]">
              Want an <em>accurate</em> quote?
            </h2>
            <p data-rise className="mx-auto mt-6 max-w-md opacity-80">
              Book a free consultation with an InnerSpacio designer for a detailed quote.
            </p>
            {consult ? (
              <p className="mt-10 flex items-center justify-center gap-2 text-saffron">
                <Check className="size-5" /> Request received — we&apos;ll be in touch soon.
              </p>
            ) : (
              <Button size="lg" className="mt-10 bg-saffron text-foreground hover:bg-[#ffe066]" onClick={requestConsult} disabled={busy}>
                {busy && <Loader2 className="size-4 animate-spin" />}
                Book free consultation
              </Button>
            )}
            {err && (
              <p role="alert" className="mt-4 text-sm text-[#ffb59a]">
                {err}
              </p>
            )}
            <p className="mx-auto mt-16 max-w-xl text-xs opacity-60">
              Estimates are based on typical project spends. The final price varies with finishes, furniture, civil
              work and site conditions.
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}
