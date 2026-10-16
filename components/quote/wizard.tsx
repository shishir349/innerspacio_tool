"use client";

import { shrinkImage } from "@/lib/client-image";
import { useEffect, useMemo, useRef, useState } from "react";
import { Camera, Check, Loader2, Minus, Plus, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { Pop } from "@/components/motion/pop";
import { ConceptSlider, type SlideItem } from "@/components/quote/concept-slider";
import { EstimateView, type QuoteEstimate } from "@/components/quote/estimate-view";
import { EASE, MOTION_OK, gsap, useGSAP } from "@/lib/motion";
import {
  BHK_OPTIONS,
  CITIES,
  MAX_IDEAS_LENGTH,
  BHK_ROOM_DEFAULTS,
  MAX_PHOTOS_PER_ROOM,
  MAX_PHOTO_ROOMS,
  MAX_QUOTE_ROOMS,
  PACKAGE_TIERS,
  QUOTE_ROOM_TYPES,
  SIZED_BHKS,
  TIER_INFO,
  type Bhk,
  type HomeSize,
  type PackageTier,
  type QuoteRoomType,
} from "@/lib/quote/constants";

// One form, seven tabs. Photos are optional and every render costs money, so generation starts only
// for rooms that have a photo, the moment the visitor leaves the Photos tab. Details is just the form;
// the Estimate tab keeps them busy while the renders finish in the background; Reimagined shows them.
const STEPS = ["Home", "Rooms", "Package", "Photos", "Details", "Estimate", "Reimagined"] as const;
const PHOTOS_STEP = 3;
const DETAILS_STEP = 4;
const ESTIMATE_STEP = 5;
const LAST_STEP = STEPS.length - 1;

interface RoomDraft {
  key: string; // stable client key, e.g. bedroom-2
  roomType: QuoteRoomType;
  label: string;
  ideas: string;
}

interface Draft {
  step: number;
  bhk: Bhk | null;
  homeSize: HomeSize;
  counts: Partial<Record<QuoteRoomType, number>>;
  /** The visitor edited the rooms by hand: a later BHK change must not overwrite that. */
  roomsEdited: boolean;
  ideas: Record<string, string>;
  tier: PackageTier | null;
  name: string;
  email: string;
  phone: string;
  whatsapp: boolean;
  city: string;
  consent: boolean;
}

const EMPTY: Draft = {
  step: 0,
  bhk: null,
  homeSize: "small",
  counts: {},
  roomsEdited: false,
  ideas: {},
  tier: null,
  name: "",
  email: "",
  phone: "",
  whatsapp: true,
  city: "",
  consent: false,
};

function expandRooms(counts: Draft["counts"], ideas: Draft["ideas"]): RoomDraft[] {
  const out: RoomDraft[] = [];
  for (const t of QUOTE_ROOM_TYPES) {
    const n = counts[t.value] ?? 0;
    const base = t.label.replace(/ \(.*\)$/, "");
    for (let i = 1; i <= n; i++) {
      const key = `${t.value}-${i}`;
      out.push({ key, roomType: t.value, label: n > 1 ? `${base} ${i}` : base, ideas: ideas[key] ?? "" });
    }
  }
  return out;
}

export function QuoteWizard() {
  const [d, setD] = useState<Draft>(EMPTY);
  // Photos can't live in sessionStorage; they stay in memory for this visit.
  const [photos, setPhotos] = useState<Record<string, File[]>>({});
  const [error, setError] = useState<string | null>(null);
  const [cityOpen, setCityOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [starting, setStarting] = useState(false);
  const [quote, setQuote] = useState<QuoteEstimate | null>(null);
  const [consult, setConsult] = useState<"idle" | "sending" | "sent">("idle");
  // Per-room generation state, filled in the background after the photos step.
  const [gen, setGen] = useState<Record<string, Omit<SlideItem, "key" | "label">>>({});
  const leadRef = useRef<{ leadId: string; token: string; sig: string } | null>(null);
  const honeypot = useRef<HTMLInputElement>(null);

  // Shake the error line so a failed step is noticed (not just announced).
  useGSAP(
    () => {
      if (!error) return;
      const mm = gsap.matchMedia();
      mm.add(MOTION_OK, () => {
        gsap.fromTo("[data-error]", { x: -8 }, { x: 0, duration: 0.5, ease: "elastic.out(1,0.35)" });
      });
      return () => mm.revert();
    },
    { dependencies: [error] }
  );

  const rooms = useMemo(() => expandRooms(d.counts, d.ideas), [d.counts, d.ideas]);
  const totalRooms = rooms.length;
  const withPhotos = rooms.filter((r) => (photos[r.key]?.length ?? 0) > 0);
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((p) => ({ ...p, [k]: v }));
  // Functional so fast taps never overwrite each other with a stale count.
  const bump = (t: QuoteRoomType, delta: number) =>
    setD((p) => {
      const total = Object.values(p.counts).reduce((a, b) => a + (b ?? 0), 0);
      const max = QUOTE_ROOM_TYPES.find((r) => r.value === t)?.max ?? 0;
      const n = p.counts[t] ?? 0;
      const nextN = Math.max(0, n + delta);
      if (nextN > max || (delta > 0 && total >= MAX_QUOTE_ROOMS)) return p;
      return { ...p, roomsEdited: true, counts: { ...p.counts, [t]: nextN } };
    });
  // Picking a home type pre-fills a typical set of rooms (unless the visitor already tuned them).
  const pickBhk = (b: Bhk) =>
    setD((p) => ({ ...p, bhk: b, counts: p.roomsEdited ? p.counts : { ...BHK_ROOM_DEFAULTS[b] } }));

  function validate(step: number): string | null {
    if (step === 0 && !d.bhk) return "Please choose your home type.";
    if (step === 1 && totalRooms === 0) return "Select at least one room.";
    if (step === 2 && !d.tier) return "Please pick a package.";
    if (step === DETAILS_STEP) {
      if (d.name.trim().length < 2) return "Please enter your name.";
      if (!/^\S+@\S+\.\S+$/.test(d.email)) return "Enter a valid email address.";
      if (!/^\+?[0-9][0-9\s-]{7,16}$/.test(d.phone.trim())) return "Enter a valid phone number.";
      if (!d.city) return "Please select your city.";
      if (!d.consent) return "Please accept the privacy terms to continue.";
    }
    return null;
  }

  async function next() {
    const problem = validate(d.step);
    setError(problem);
    if (problem) return;
    if (d.step === DETAILS_STEP) {
      await submit();
      return;
    }
    if (d.step === PHOTOS_STEP) {
      // Leaving the photos step: create the draft and start rendering the rooms that have a photo.
      const failure = await startGeneration();
      if (failure) {
        setError(failure);
        return;
      }
    }
    set("step", d.step + 1);
  }

  function signature() {
    return JSON.stringify({
      b: d.bhk,
      s: d.homeSize,
      t: d.tier,
      r: rooms.map((r) => [r.roomType, r.ideas, (photos[r.key] ?? []).map((f) => f.name + f.size)]),
    });
  }

  /** Returns an error message, or null when the draft exists (and rendering is running or not needed). */
  async function startGeneration(): Promise<string | null> {
    const sig = signature();
    if (leadRef.current?.sig === sig) return null; // nothing changed since last time
    setStarting(true);
    try {
      const res = await fetch("/api/public/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bhk: d.bhk,
          homeSize: d.bhk && SIZED_BHKS.includes(d.bhk) ? d.homeSize : undefined,
          packageTier: d.tier,
          rooms: rooms.map((r) => ({ roomType: r.roomType, ideas: r.ideas || undefined })),
        }),
      });
      const lead = await res.json();
      if (!res.ok) return lead.error ?? "Could not start. Please try again.";

      leadRef.current = { leadId: lead.leadId, token: lead.token, sig };
      const todo = rooms
        .map((r, i) => ({ r, id: lead.rooms[i].id as string }))
        .filter(({ r }) => (photos[r.key]?.length ?? 0) > 0);
      setGen(Object.fromEntries(todo.map(({ r }) => [r.key, { state: "queued" as const }])));
      void runQueue(lead.leadId, lead.token, todo, photos);
      return null;
    } catch {
      return "Network problem. Please check your connection and try again.";
    } finally {
      setStarting(false);
    }
  }

  async function runQueue(
    leadId: string,
    token: string,
    todo: { r: RoomDraft; id: string }[],
    ph: Record<string, File[]>
  ) {
    const live = () => leadRef.current?.leadId === leadId; // ignore results of a superseded draft
    const patch = (key: string, v: Omit<SlideItem, "key" | "label">) => {
      if (live()) setGen((g) => ({ ...g, [key]: v }));
    };

    async function one(i: number) {
      const { r, id } = todo[i];
      patch(r.key, { state: "run" });
      const form = new FormData();
      for (const f of ph[r.key] ?? []) form.append("photos", await shrinkImage(f));
      let msg: string | undefined;
      // Generation can run ~60s+; a proxy may cut the connection while the server
      // finishes. The server is idempotent + de-duplicates, so retrying is safe.
      for (let attempt = 0; attempt < 3; attempt++) {
        msg = undefined;
        try {
          const res = await fetch(`/api/public/quote/${leadId}/rooms/${id}`, {
            method: "POST",
            headers: { "x-quote-token": token },
            body: form,
          });
          if (res.ok) {
            const out = await res.json();
            patch(r.key, { state: "done", url: out.concept?.url, isDemo: out.concept?.isDemo });
            return;
          }
          const body = await res.json().catch(() => null);
          msg = body?.error ?? "Could not generate this image.";
          if (![502, 503, 504].includes(res.status)) break; // 4xx: retrying won't help
        } catch {
          msg = "Network problem.";
        }
        await new Promise((res) => setTimeout(res, 4000));
      }
      patch(r.key, { state: "fail", msg });
    }

    // Two at a time: faster than serial, gentle on the host and the image API.
    let nextIndex = 0;
    const worker = async () => {
      while (nextIndex < todo.length) await one(nextIndex++);
    };
    await Promise.all([worker(), worker()]);
  }

  async function submit() {
    setSubmitting(true);
    setError(null);
    try {
      const lead = leadRef.current;
      if (!lead) throw new Error("Please go back and continue from the Photos step first.");
      const res = await fetch(`/api/public/quote/${lead.leadId}/finalize`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-quote-token": lead.token },
        body: JSON.stringify({
          city: d.city,
          name: d.name.trim(),
          email: d.email.trim(),
          phone: d.phone.trim(),
          whatsappOptIn: d.whatsapp,
          consent: d.consent,
          website: honeypot.current?.value ?? "",
        }),
      });
      const out = await res.json().catch(() => ({}));
      if (!res.ok || !out.estimate) throw new Error(out.error ?? "Could not submit. Please try again.");
      setQuote({ estimate: out.estimate, tiers: out.tiers, breakdown: out.breakdown });
      set("step", ESTIMATE_STEP);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  async function requestConsult() {
    const lead = leadRef.current;
    if (!lead) return;
    setConsult("sending");
    try {
      const res = await fetch("/api/public/quote/consult", { method: "POST", headers: { "x-quote-token": lead.token } });
      if (!res.ok) throw new Error();
      setConsult("sent");
    } catch {
      setConsult("idle");
      setError("Could not send your request. Please try again.");
    }
  }

  // The visitor's own photo is the "before" of each finished render.
  const befores = useMemo(
    () => Object.fromEntries(withPhotos.map((r) => [r.key, URL.createObjectURL(photos[r.key][0])])),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [photos, d.counts]
  );
  useEffect(() => () => Object.values(befores).forEach((u) => URL.revokeObjectURL(u)), [befores]);

  const slides: SlideItem[] = withPhotos.map((r) => ({
    key: r.key,
    label: r.label,
    beforeUrl: befores[r.key],
    ...(gen[r.key] ?? { state: "queued" as const }),
  }));
  const ready = slides.filter((x) => x.state === "done" || x.state === "fail").length;
  const finished = d.step >= ESTIMATE_STEP;

  return (
    <Shell step={d.step}>
      {d.step === 0 && (
        <section>
          <Heading title="What's your home type?" sub="This helps us size your estimate." />
          <div className="mt-6 grid gap-3">
            {BHK_OPTIONS.map((b) => (
              <div key={b}>
                <ChoiceCard selected={d.bhk === b} onClick={() => pickBhk(b)}>
                  {b === "5+" ? "5 BHK+" : `${b} BHK`}
                </ChoiceCard>
                {d.bhk === b && SIZED_BHKS.includes(b) && (
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    {(["small", "large"] as const).map((s) => (
                      <ChoiceCard key={s} selected={d.homeSize === s} onClick={() => set("homeSize", s)}>
                        <span className="block capitalize">{s}</span>
                        <span className="block text-[0.95rem] text-muted-foreground">
                          {s === "small" ? "Below 1200 sq ft" : "Above 1200 sq ft"}
                        </span>
                      </ChoiceCard>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {d.step === 1 && (
        <section>
          <Heading
            title="Which rooms should we design?"
            sub={`We filled in a typical ${d.bhk === "5+" ? "5 BHK+" : `${d.bhk} BHK`}. Add or remove anything (up to ${MAX_QUOTE_ROOMS} rooms).`}
          />
          <div className="mt-6 grid gap-3">
            {QUOTE_ROOM_TYPES.map((t) => {
              const n = d.counts[t.value] ?? 0;
              const canAdd = n < t.max && totalRooms < MAX_QUOTE_ROOMS;
              return (
                <div
                  key={t.value}
                  className="flex items-center justify-between rounded-2xl border border-border bg-card px-5 py-4"
                >
                  <span className="display text-[1.5rem]">{t.label}</span>
                  <div className="flex items-center gap-3">
                    <Stepper label={`Remove ${t.label}`} disabled={n === 0} onClick={() => bump(t.value, -1)}>
                      <Minus className="size-4" />
                    </Stepper>
                    <span className="num w-6 text-center text-lg">
                      <Pop key={n} from={0.6}>{n}</Pop>
                    </span>
                    <Stepper label={`Add ${t.label}`} disabled={!canAdd} onClick={() => bump(t.value, 1)}>
                      <Plus className="size-4" />
                    </Stepper>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {d.step === 2 && (
        <section>
          <Heading title="Pick your package" sub="You can change this later with your designer." />
          <div className="mt-6 grid gap-3">
            {PACKAGE_TIERS.map((t) => {
              const info = TIER_INFO[t];
              const world =
                t === "essential" ? "bg-sand text-foreground" : t === "premium" ? "surface-olive" : "surface-terracotta";
              const on = d.tier === t;
              return (
                <button
                  key={t}
                  type="button"
                  aria-pressed={on}
                  onClick={(e) => {
                    gsap.fromTo(e.currentTarget, { scale: 0.98 }, { scale: 1, duration: 0.5, ease: EASE.pop });
                    set("tier", t);
                  }}
                  className={cn(
                    "relative w-full rounded-3xl p-7 text-left transition-[box-shadow,transform] duration-500 ease-(--ease-out-expo)",
                    world,
                    on ? "ring-2 ring-offset-4 ring-offset-background ring-saffron" : "hover:-translate-y-1"
                  )}
                >
                  <span className="flex items-start justify-between gap-4">
                    <span className="display text-[2.2rem]">{info.label}</span>
                    <span
                      aria-hidden
                      className={cn(
                        "grid size-8 place-items-center rounded-full transition-all duration-300",
                        on ? "scale-100 bg-saffron text-foreground" : "scale-75 border border-current opacity-40"
                      )}
                    >
                      {on && <Check className="size-4" />}
                    </span>
                  </span>
                  <span className="mt-2 block max-w-md opacity-90">{info.blurb}</span>
                  <span className="mt-5 grid gap-2 sm:grid-cols-2">
                    {info.bullets.map((b) => (
                      <span key={b} className="flex items-center gap-2">
                        <Check className="size-4 shrink-0 opacity-70" />
                        {b}
                      </span>
                    ))}
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {d.step === PHOTOS_STEP && (
        <section>
          <Heading
            title="Show us the space"
            sub={`Optional. Add a photo of a room and we'll render a design concept for it while you finish (up to ${MAX_PHOTO_ROOMS} rooms). Skip any room you like.`}
          />
          <div className="mt-6 space-y-5">
            {rooms.map((r) => (
              <RoomPhotoCard
                key={r.key}
                room={r}
                files={photos[r.key] ?? []}
                canAdd={(photos[r.key]?.length ?? 0) > 0 || withPhotos.length < MAX_PHOTO_ROOMS}
                onFiles={(f) => setPhotos((p) => ({ ...p, [r.key]: f }))}
                onIdeas={(v) => setD((p) => ({ ...p, ideas: { ...p.ideas, [r.key]: v } }))}
              />
            ))}
          </div>
        </section>
      )}

      {d.step === DETAILS_STEP && (
        <section>
          <Heading title="Where should we send your estimate?" sub="Just a few details and your estimate is on the next screen." />
          <div className="mt-8 space-y-5">
            <Field id="q-name" label="Name">
              <Input id="q-name" autoComplete="name" value={d.name} onChange={(e) => set("name", e.target.value)} />
            </Field>
            <Field id="q-email" label="Email">
              <Input id="q-email" type="email" autoComplete="email" value={d.email} onChange={(e) => set("email", e.target.value)} />
            </Field>
            <Field id="q-phone" label="Phone">
              <Input
                id="q-phone"
                type="tel"
                autoComplete="tel"
                inputMode="tel"
                placeholder="+91"
                value={d.phone}
                onChange={(e) => set("phone", e.target.value)}
              />
            </Field>
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={d.whatsapp}
                onChange={(e) => set("whatsapp", e.target.checked)}
                className="size-5 accent-[var(--primary)]"
              />
              Send me updates on WhatsApp
            </label>
            <Field id="q-city" label="City">
              <Button id="q-city" type="button" variant="outline" className="h-12 w-full justify-between" onClick={() => setCityOpen(true)}>
                {d.city || "Select city"}
              </Button>
            </Field>
            {/* Honeypot: hidden from people and assistive tech; bots fill it. */}
            <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
              <label>
                Website
                <input ref={honeypot} name="website" tabIndex={-1} autoComplete="off" />
              </label>
            </div>
            <label className="flex items-start gap-3 text-muted-foreground">
              <input
                type="checkbox"
                checked={d.consent}
                onChange={(e) => set("consent", e.target.checked)}
                className="mt-1 size-5 accent-[var(--primary)]"
              />
              <span>
                I agree to InnerSpacio storing my details and room photos to prepare this estimate and contact me about it.
              </span>
            </label>
          </div>
        </section>
      )}

      {d.step === ESTIMATE_STEP && quote && d.tier && (
        <section>
          <Heading title="Your estimate" sub={`${d.name.trim().split(" ")[0]}, here's what your home could cost.`} />
          <div className="mt-8">
            <EstimateView
              quote={quote}
              tier={d.tier}
              progress={slides.length ? { ready, total: slides.length } : undefined}
            />
          </div>
        </section>
      )}

      {d.step === LAST_STEP && (
        <section>
          <Heading
            title="Your rooms, reimagined"
            sub={
              slides.length
                ? "Drag the handle to compare your room with its concept. AI concepts are inspiration, not a final design."
                : "You skipped photos, so there are no concepts to show. Your designer can create them with you."
            }
          />
          {slides.length > 0 && (
            <div className="mt-8">
              <ConceptSlider items={slides} />
              {ready < slides.length && (
                <p className="mt-4 text-center text-muted-foreground">
                  {slides.length - ready} room{slides.length - ready === 1 ? " is" : "s are"} still rendering. They appear here as they finish.
                </p>
              )}
            </div>
          )}
          <div className="surface-night mt-14 rounded-3xl p-8 text-center sm:p-12">
            <h2 className="display display-md">
              Want an <em>accurate</em> quote?
            </h2>
            <p className="mx-auto mt-4 max-w-md opacity-85">Book a free consultation with an InnerSpacio designer for a detailed quote.</p>
            {consult === "sent" ? (
              <p className="mt-8 flex items-center justify-center gap-2 text-saffron">
                <Check className="size-5" /> Request received. We&apos;ll be in touch soon.
              </p>
            ) : (
              <Button
                size="lg"
                className="mt-8 bg-saffron text-foreground hover:bg-[#ffe066]"
                onClick={() => void requestConsult()}
                disabled={consult === "sending"}
              >
                {consult === "sending" && <Loader2 className="size-4 animate-spin" />}
                Book free consultation
              </Button>
            )}
          </div>
        </section>
      )}

      {error && (
        <p role="alert" data-error className="mt-5 text-destructive animate-in fade-in slide-in-from-bottom-1 duration-300">
          {error}
        </p>
      )}

      {d.step !== LAST_STEP && (
        <div
          data-no-anim
          className="sticky bottom-0 -mx-5 mt-10 flex items-center justify-between border-t border-border/70 bg-background/90 px-5 py-4 backdrop-blur-md"
        >
          <Button
            variant="ghost"
            onClick={() => {
              setError(null);
              set("step", Math.max(0, d.step - 1));
            }}
            disabled={d.step === 0 || starting || submitting || finished}
          >
            Back
          </Button>
          <Button size="lg" className="min-w-44 gap-2" onClick={() => void next()} disabled={starting || submitting}>
            {(starting || submitting) && <Loader2 className="size-4 animate-spin" />}
            {d.step === DETAILS_STEP
              ? "See my estimate"
              : d.step === ESTIMATE_STEP
                ? "See reimagined rooms"
                : d.step === PHOTOS_STEP && withPhotos.length === 0
                  ? "Skip photos"
                  : "Next"}
          </Button>
        </div>
      )}

      <CityDialog
        open={cityOpen}
        onOpenChange={setCityOpen}
        onPick={(c) => {
          set("city", c);
          setCityOpen(false);
        }}
      />
    </Shell>
  );
}

function Shell({ step, children }: { step: number; children: React.ReactNode }) {
  const root = useRef<HTMLDivElement>(null);
  const prevStep = useRef(step);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add(MOTION_OK, () => {
        // Direction-aware: forward slides in from the right, back from the left.
        const dir = step >= prevStep.current ? 1 : -1;
        prevStep.current = step;
        gsap.fromTo(
          "main > *:not([data-no-anim])",
          { x: 28 * dir, autoAlpha: 0 },
          { x: 0, autoAlpha: 1, duration: 0.55, ease: EASE.out, stagger: 0.06, clearProps: "transform,opacity,visibility" }
        );
        gsap.to("[data-seg]", {
          scaleX: (i: number) => (i <= step ? 1 : 0),
          duration: 0.6,
          ease: EASE.soft,
          stagger: 0.04,
        });
      });
      return () => mm.revert();
    },
    { scope: root, dependencies: [step] }
  );

  return (
    <div ref={root} className="min-h-screen bg-background">
      <div className="sticky top-[72px] z-30 border-b border-border/60 bg-background/90 backdrop-blur-md">
        <ol className="mx-auto flex max-w-3xl gap-2 px-5 py-4" aria-label="Progress">
          {STEPS.map((s, i) => (
            <li key={s} className="flex-1" aria-current={i === step ? "step" : undefined}>
              <div className="h-px overflow-hidden bg-foreground/15">
                <div data-seg className="h-0.5 origin-left bg-saffron" style={{ transform: `scaleX(${i <= step ? 1 : 0})` }} />
              </div>
              <span
                className={cn(
                  "mt-2 flex items-center gap-1.5 text-[0.85rem] font-medium transition-colors",
                  i === step ? "text-foreground" : "text-muted-foreground"
                )}
              >
                <span className="num">{i + 1}</span>
                <span className="hidden md:inline">{s}</span>
              </span>
            </li>
          ))}
        </ol>
      </div>
      <main className="mx-auto max-w-3xl px-5 pt-14 pb-6">{children}</main>
    </div>
  );
}

function Heading({ title, sub }: { title: string; sub: string }) {
  return (
    <div>
      <h1 className="display display-md">{title}</h1>
      <p className="mt-4 max-w-lg text-[1.05rem] text-muted-foreground">{sub}</p>
    </div>
  );
}

function Field({ id, label, children }: { id: string; label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={id} className="text-[0.95rem]">
        {label}
      </Label>
      {children}
    </div>
  );
}

function ChoiceCard({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={(e) => {
        gsap.fromTo(e.currentTarget, { scale: 0.97 }, { scale: 1, duration: 0.45, ease: EASE.pop });
        onClick();
      }}
      aria-pressed={selected}
      className={cn(
        "relative w-full rounded-2xl border bg-card px-5 py-4 text-left text-[1.05rem] transition-[border-color,background-color,transform] duration-300 ease-(--ease-out-expo)",
        selected ? "border-foreground bg-secondary/70" : "border-border hover:-translate-y-0.5 hover:border-foreground/50"
      )}
    >
      {selected && <span aria-hidden className="absolute top-4 right-4 size-2.5 rounded-full bg-saffron" />}
      {children}
    </button>
  );
}

function Stepper({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="grid size-11 place-items-center rounded-full border border-foreground/30 text-foreground transition-[background-color,color,opacity] duration-300 hover:bg-foreground hover:text-background disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-foreground"
    >
      {children}
    </button>
  );
}

function RoomPhotoCard({
  room,
  files,
  canAdd,
  onFiles,
  onIdeas,
}: {
  room: RoomDraft;
  files: File[];
  canAdd: boolean;
  onFiles: (f: File[]) => void;
  onIdeas: (v: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const urls = useMemo(() => files.map((f) => URL.createObjectURL(f)), [files]);
  useEffect(() => () => urls.forEach((x) => URL.revokeObjectURL(x)), [urls]);

  return (
    <div className="rounded-3xl border border-border bg-card p-6">
      <h2 className="display text-[1.7rem]">{room.label}</h2>
      <div className="mt-4 flex flex-wrap gap-2">
        {urls.map((u, i) => (
          <div key={u} className="relative size-28 overflow-hidden rounded-2xl border border-border">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={u} alt={`${room.label} photo ${i + 1}`} className="size-full object-cover" />
            <button
              type="button"
              aria-label="Remove photo"
              onClick={() => onFiles(files.filter((_, j) => j !== i))}
              className="absolute top-1 right-1 grid size-7 place-items-center rounded-full bg-background/90"
            >
              <X className="size-4" />
            </button>
          </div>
        ))}
        {files.length < MAX_PHOTOS_PER_ROOM && canAdd && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="grid size-28 place-items-center rounded-2xl border border-dashed border-foreground/30 text-muted-foreground transition-colors duration-300 hover:border-foreground hover:bg-secondary hover:text-foreground"
          >
            <span className="flex flex-col items-center gap-1 text-[0.95rem]">
              <Camera className="size-5" />
              Add photo
            </span>
          </button>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          const picked = Array.from(e.target.files ?? []);
          onFiles([...files, ...picked].slice(0, MAX_PHOTOS_PER_ROOM));
          e.target.value = "";
        }}
      />
      <Label htmlFor={`ideas-${room.key}`} className="mt-5 block text-[0.95rem] text-muted-foreground">
        What do you have in mind? (optional)
      </Label>
      <Textarea
        id={`ideas-${room.key}`}
        className="mt-2"
        rows={3}
        maxLength={MAX_IDEAS_LENGTH}
        placeholder="e.g. warm wooden tones, more storage, a reading corner by the window"
        defaultValue={room.ideas}
        onChange={(e) => onIdeas(e.target.value)}
      />
    </div>
  );
}

function CityDialog({
  open,
  onOpenChange,
  onPick,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onPick: (c: string) => void;
}) {
  const [q, setQ] = useState("");
  const list = CITIES.filter((c) => c.toLowerCase().includes(q.trim().toLowerCase()));
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[80vh] gap-0 overflow-hidden p-0 sm:max-w-sm">
        <DialogHeader className="px-6 pt-6 pb-4">
          <DialogTitle>Select city</DialogTitle>
        </DialogHeader>
        <div className="relative px-6 pb-4">
          <Search className="absolute top-3 left-9 size-4 text-muted-foreground" />
          <Input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search city" className="pl-10" aria-label="Search city" />
        </div>
        <ul data-lenis-prevent className="max-h-[50vh] overflow-y-auto border-t border-border">
          {list.map((c) => (
            <li key={c}>
              <button
                type="button"
                onClick={() => onPick(c)}
                className="w-full border-b border-border px-6 py-3.5 text-left hover:bg-secondary"
              >
                {c}
              </button>
            </li>
          ))}
          {list.length === 0 && <li className="px-6 py-6 text-muted-foreground">No match.</li>}
        </ul>
      </DialogContent>
    </Dialog>
  );
}
