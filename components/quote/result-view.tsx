"use client";

import { useRef, useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BeforeAfterSlider } from "@/components/present/before-after-slider";
import { Reveal } from "@/components/motion/reveal";
import { CountUp } from "@/components/motion/count-up";
import { EASE, MOTION_OK, gsap, useGSAP } from "@/lib/motion";
import { TIER_INFO } from "@/lib/quote/constants";
import { formatLakh, formatRange } from "@/lib/quote/format";
import type { QuoteResult } from "@/lib/leads/service";

export function QuoteResultView({ result, token }: { result: QuoteResult; token: string }) {
  const [consult, setConsult] = useState(result.status === "consult_requested");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const tier = TIER_INFO[result.selectedTier];
  const root = useRef<HTMLDivElement>(null);

  // Hero entrance, then each room image wipes in on scroll and compare bars grow.
  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add(MOTION_OK, () => {
        gsap.from("[data-hero]", { y: 30, scale: 0.97, autoAlpha: 0, duration: 0.8, ease: EASE.out, clearProps: "all" });
        gsap.utils.toArray<HTMLElement>("[data-wipe]").forEach((el) => {
          gsap.fromTo(
            el,
            { clipPath: "inset(0 100% 0 0 round 16px)" },
            {
              clipPath: "inset(0 0% 0 0 round 16px)",
              duration: 1.1,
              ease: "power3.inOut",
              clearProps: "clipPath",
              scrollTrigger: { trigger: el, start: "top 85%", once: true },
            }
          );
        });
        gsap.utils.toArray<HTMLElement>("[data-bar]").forEach((el) => {
          gsap.from(el, {
            scaleX: 0,
            duration: 0.9,
            ease: EASE.out,
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
      <header className="border-b border-border bg-card">
        <div className="mx-auto max-w-2xl px-4 py-3">
          <span className="editorial-heading text-lg italic">InnerSpacio</span>
        </div>
      </header>

      <main className="mx-auto max-w-2xl space-y-8 px-4 py-8">
        <section data-hero className="rounded-xl border border-border bg-card p-6 text-center">
          <p className="text-sm text-muted-foreground">
            {result.name.split(" ")[0]}, here&apos;s your estimated budget range
          </p>
          <p className="editorial-heading mt-2 text-4xl text-primary">
            <CountUp value={result.estimate.lowLakh} format="lakh" /> –{" "}
            <CountUp value={result.estimate.highLakh} format="lakh" />
          </p>
          <p className="mt-1 text-sm">{tier.label} package</p>
          <p className="mx-auto mt-3 max-w-md rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
            This is an indicative range, not a final quote. It can be tailored to your needs.
          </p>
        </section>

        <section aria-labelledby="designs">
          <h2 id="designs" className="editorial-heading text-xl">
            Your design concepts
          </h2>
          <Reveal className="mt-4 space-y-6" stagger={0.15}>
            {result.rooms.map((r) => (
              <article key={r.id} className="rounded-xl border border-border bg-card p-4">
                <h3 className="text-sm font-medium">{r.label}</h3>
                {r.concept && r.beforeUrl ? (
                  <div data-wipe className="mt-3">
                    <BeforeAfterSlider
                      beforeSrc={r.beforeUrl}
                      afterSrc={r.concept.url}
                      afterLabel={r.concept.isDemo ? "Illustrative placeholder" : "AI concept"}
                    />
                  </div>
                ) : (
                  <p className="mt-3 text-sm text-muted-foreground">
                    Your image for this room isn&apos;t ready yet — a designer will share it with you.
                  </p>
                )}
                {r.ideas && <p className="mt-3 text-xs text-muted-foreground">Your note: {r.ideas}</p>}
              </article>
            ))}
          </Reveal>
          <p className="mt-3 text-xs text-muted-foreground">
            Images are AI-generated concepts for inspiration. Final design depends on a site visit and
            measurements.
          </p>
        </section>

        <section aria-labelledby="basis">
          <h2 id="basis" className="editorial-heading text-xl">
            How we got this number
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Your range is built line by line from InnerSpacio&apos;s published rates, not guessed. About{" "}
            <span className="tabular-nums">{formatLakh(result.breakdown.totalLakh)}</span> of work across{" "}
            {result.breakdown.byRoom.length} areas, with a range for site conditions and final choices.
          </p>

          <div className="mt-4 rounded-xl border border-border bg-card p-4">
            <h3 className="text-sm font-medium">Where the money goes</h3>
            <ul className="mt-3 space-y-3">
              {result.breakdown.byTrade.map((t) => (
                <li key={t.label} className="text-sm">
                  <div className="flex items-baseline justify-between gap-3">
                    <span>{t.label}</span>
                    <span className="tabular-nums text-muted-foreground">
                      {formatLakh(t.lakh)} · {t.pct}%
                    </span>
                  </div>
                  <span className="mt-1 block h-1.5 rounded-full bg-border/60" aria-hidden>
                    <span
                      data-bar
                      className="block h-full origin-left rounded-full bg-primary/70"
                      style={{ width: `${Math.max(3, t.pct)}%` }}
                    />
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-border bg-card p-4">
              <h3 className="text-sm font-medium">By room</h3>
              <ul className="mt-3 space-y-1.5 text-sm">
                {result.breakdown.byRoom.map((r) => (
                  <li key={r.label} className="flex justify-between gap-3">
                    <span>{r.label}</span>
                    <span className="tabular-nums text-muted-foreground">{formatLakh(r.lakh)}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-xl border border-border bg-card p-4">
              <h3 className="text-sm font-medium">Biggest items</h3>
              <ul className="mt-3 space-y-2 text-sm">
                {result.breakdown.highlights.map((h, i) => (
                  <li key={i}>
                    <span className="text-muted-foreground">{h.room}: </span>
                    {h.text}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <ul className="mt-4 list-disc space-y-1 pl-5 text-xs text-muted-foreground">
            {result.breakdown.assumptions.map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="compare">
          <h2 id="compare" className="editorial-heading text-xl">
            Compare packages
          </h2>
          <ul className="mt-4 grid gap-2">
            {result.tiers.map((t) => (
              <li
                key={t.tier}
                className={
                  "relative flex items-center justify-between rounded-lg border px-4 pt-3 pb-4 text-sm " +
                  (t.tier === result.selectedTier ? "border-primary bg-primary/5" : "border-border bg-card")
                }
              >
                <span className="flex items-center gap-2">
                  {t.tier === result.selectedTier && <Check className="size-4 text-primary" />}
                  {TIER_INFO[t.tier].label}
                </span>
                <span className="tabular-nums">{formatRange(t)}</span>
                <span className="absolute inset-x-4 bottom-1.5 h-0.5 rounded-full bg-border/60" aria-hidden>
                  <span
                    data-bar
                    className="block h-full origin-left rounded-full bg-primary/70"
                    style={{ width: `${Math.max(6, Math.min(100, (t.highLakh / 90) * 100))}%` }}
                  />
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-xl bg-muted p-6 text-center">
          <h2 className="editorial-heading text-xl">Want an accurate quote?</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Book a free consultation with an InnerSpacio designer for a detailed quote.
          </p>
          {consult ? (
            <p className="mt-4 flex items-center justify-center gap-2 text-sm font-medium text-primary">
              <Check className="size-4" /> Request received — we&apos;ll be in touch soon.
            </p>
          ) : (
            <Button size="lg" className="mt-4" onClick={requestConsult} disabled={busy}>
              {busy && <Loader2 className="size-4 animate-spin" />}
              Book free consultation
            </Button>
          )}
          {err && (
            <p role="alert" className="mt-2 text-sm text-destructive">
              {err}
            </p>
          )}
        </section>

        <p className="text-xs text-muted-foreground">
          Estimates are based on typical project spends. The final price varies with finishes, furniture, civil
          work and site conditions.
        </p>
      </main>
    </div>
  );
}
