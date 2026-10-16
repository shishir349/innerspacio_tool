"use client";

import { shrinkImage } from "@/lib/client-image";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, Check, Loader2, Minus, Plus, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { Pop } from "@/components/motion/pop";
import { ConceptSlider, type SlideItem } from "@/components/quote/concept-slider";
import { EASE, MOTION_OK, gsap, useGSAP } from "@/lib/motion";
import {
  BHK_OPTIONS,
  CITIES,
  MAX_IDEAS_LENGTH,
  MAX_PHOTOS_PER_ROOM,
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

// Package comes BEFORE photos so image generation (style depends on the
// tier) can start the moment the visitor leaves the photos step.
const STEPS = ["Home", "Rooms", "Package", "Photos", "Details"] as const;
const PHOTOS_STEP = 3;
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
  const router = useRouter();
  const [d, setD] = useState<Draft>(EMPTY);
  // Photos can't live in sessionStorage; they stay in memory for this visit.
  const [photos, setPhotos] = useState<Record<string, File[]>>({});
  const [error, setError] = useState<string | null>(null);
  const [cityOpen, setCityOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [starting, setStarting] = useState(false);
  // Per-room generation state, filled in the background after the photos step.
  const [gen, setGen] = useState<Record<string, Omit<SlideItem, "key" | "label">>>({});
  const leadRef = useRef<{ leadId: string; token: string; sig: string } | null>(null);
  const allDone = useRef<Promise<void>>(Promise.resolve());
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
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((p) => ({ ...p, [k]: v }));
  // Functional so fast taps never overwrite each other with a stale count.
  const bump = (t: QuoteRoomType, delta: number) =>
    setD((p) => {
      const total = Object.values(p.counts).reduce((a, b) => a + (b ?? 0), 0);
      const max = QUOTE_ROOM_TYPES.find((r) => r.value === t)?.max ?? 0;
      const n = p.counts[t] ?? 0;
      const nextN = Math.max(0, n + delta);
      if (nextN > max || (delta > 0 && total >= MAX_QUOTE_ROOMS)) return p;
      return { ...p, counts: { ...p.counts, [t]: nextN } };
    });

  function validate(step: number): string | null {
    if (step === 0 && !d.bhk) return "Please choose your home type.";
    if (step === 1 && totalRooms === 0) return "Select at least one room.";
    if (step === 2 && !d.tier) return "Please pick a package.";
    if (step === PHOTOS_STEP) {
      const missing = rooms.find((r) => (photos[r.key]?.length ?? 0) === 0);
      if (missing) return `Add a photo of your ${missing.label.toLowerCase()}.`;
    }
    if (step === LAST_STEP) {
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
    if (d.step === LAST_STEP) {
      void submit();
      return;
    }
    if (d.step === PHOTOS_STEP) {
      // Leaving the photos step: create a draft and start generating now, so
      // images are (partly) ready by the time the visitor reaches the end.
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

  /** Returns an error message, or null when generation is running/started. */
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
      setGen(Object.fromEntries(rooms.map((r) => [r.key, { state: "queued" as const }])));
      allDone.current = runQueue(lead.leadId, lead.token, lead.rooms, rooms, photos);
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
    serverRooms: { id: string }[],
    rs: RoomDraft[],
    ph: Record<string, File[]>
  ) {
    const live = () => leadRef.current?.leadId === leadId; // ignore results of a superseded draft
    const patch = (key: string, v: Omit<SlideItem, "key" | "label">) => {
      if (live()) setGen((g) => ({ ...g, [key]: v }));
    };

    async function one(i: number) {
      const key = rs[i].key;
      patch(key, { state: "run" });
      const form = new FormData();
      for (const f of ph[key] ?? []) form.append("photos", await shrinkImage(f));
      let msg: string | undefined;
      // Generation can run ~60s+; a proxy may cut the connection while the server
      // finishes. The server is idempotent + de-duplicates, so retrying is safe.
      for (let attempt = 0; attempt < 3; attempt++) {
        msg = undefined;
        try {
          const r = await fetch(`/api/public/quote/${leadId}/rooms/${serverRooms[i].id}`, {
            method: "POST",
            headers: { "x-quote-token": token },
            body: form,
          });
          if (r.ok) {
            const out = await r.json();
            patch(key, { state: "done", url: out.concept?.url, isDemo: out.concept?.isDemo });
            return;
          }
          const body = await r.json().catch(() => null);
          msg = body?.error ?? "Could not generate this image.";
          if (![502, 503, 504].includes(r.status)) break; // 4xx: retrying won't help
        } catch {
          msg = "Network problem.";
        }
        await new Promise((res) => setTimeout(res, 4000));
      }
      patch(key, { state: "fail", msg });
    }

    // Two at a time: faster than serial, gentle on the host and the image API.
    let nextIndex = 0;
    const worker = async () => {
      while (nextIndex < rs.length) await one(nextIndex++);
    };
    await Promise.all([worker(), worker()]);
  }

  async function submit() {
    setSubmitting(true);
    setError(null);
    try {
      const lead = leadRef.current;
      if (!lead) throw new Error("Please go back and add your room photos first.");
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
      if (!res.ok) throw new Error(out.error ?? "Could not submit. Please try again.");
      await allDone.current; // contact is saved; now wait for any images still rendering
      router.push(`/get-quote/result/${lead.token}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
      setSubmitting(false);
    }
  }

  const slides: SlideItem[] = rooms.map((r) => ({
    key: r.key,
    label: r.label,
    ...(gen[r.key] ?? { state: "queued" as const }),
  }));

  if (submitting) {
    const pending = slides.filter((x) => x.state === "queued" || x.state === "run").length;
    return (
      <Shell step={LAST_STEP}>
        <h1 className="display display-md">Submitting your details…</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {pending > 0
            ? `${pending} room${pending === 1 ? "" : "s"} still rendering. Please keep this page open.`
            : "Almost there."}
        </p>
        <div className="mt-6">
          <ConceptSlider items={slides} />
        </div>
      </Shell>
    );
  }

  return (
    <Shell step={d.step}>
      {d.step === 0 && (
        <section>
          <Heading title="What's your home type?" sub="This helps us size your estimate." />
          <div className="mt-6 grid gap-3">
            {BHK_OPTIONS.map((b) => (
              <div key={b}>
                <ChoiceCard selected={d.bhk === b} onClick={() => set("bhk", b)}>
                  {b === "5+" ? "5 BHK+" : `${b} BHK`}
                </ChoiceCard>
                {d.bhk === b && SIZED_BHKS.includes(b) && (
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    {(["small", "large"] as const).map((s) => (
                      <ChoiceCard key={s} selected={d.homeSize === s} onClick={() => set("homeSize", s)}>
                        <span className="block capitalize">{s}</span>
                        <span className="block text-xs font-normal text-muted-foreground">
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
            sub={`Pick up to ${MAX_QUOTE_ROOMS}. You'll add a photo of each next.`}
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
                    <Stepper
                      label={`Remove ${t.label}`}
                      disabled={n === 0}
                      onClick={() => bump(t.value, -1)}
                    >
                      <Minus className="size-4" />
                    </Stepper>
                    <span className="num w-6 text-center text-lg">
                      <Pop key={n} from={0.6}>{n}</Pop>
                    </span>
                    <Stepper
                      label={`Add ${t.label}`}
                      disabled={!canAdd}
                      onClick={() => bump(t.value, 1)}
                    >
                      <Plus className="size-4" />
                    </Stepper>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {d.step === PHOTOS_STEP && (
        <section>
          <Heading
            title="Show us the space"
            sub="Add a clear photo of each room and tell us what you have in mind."
          />
          <div className="mt-6 space-y-5">
            {rooms.map((r) => (
              <RoomPhotoCard
                key={r.key}
                room={r}
                files={photos[r.key] ?? []}
                onFiles={(f) => setPhotos((p) => ({ ...p, [r.key]: f }))}
                onIdeas={(v) => setD((p) => ({ ...p, ideas: { ...p.ideas, [r.key]: v } }))}
              />
            ))}
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
                  <span className="mt-2 block max-w-md opacity-85">{info.blurb}</span>
                  <span className="mt-5 grid gap-2 sm:grid-cols-2">
                    {info.bullets.map((b) => (
                      <span key={b} className="flex items-center gap-2 text-[0.95rem]">
                        <Check className="size-3.5 shrink-0 opacity-70" />
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

      {d.step === LAST_STEP && (
        <section>
          <Heading
            title="Your designs are on the way"
            sub="Swipe through your rooms, then tell us where to send your estimate."
          />
          <div className="mt-5">
            <ConceptSlider items={slides} />
          </div>
          <div className="mt-8 space-y-4">
            <Field id="q-name" label="Name">
              <Input id="q-name" autoComplete="name" value={d.name} onChange={(e) => set("name", e.target.value)} />
            </Field>
            <Field id="q-email" label="Email">
              <Input
                id="q-email"
                type="email"
                autoComplete="email"
                value={d.email}
                onChange={(e) => set("email", e.target.value)}
              />
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
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={d.whatsapp}
                onChange={(e) => set("whatsapp", e.target.checked)}
                className="size-4 accent-[var(--primary)]"
              />
              Send me updates on WhatsApp
            </label>
            <Field id="q-city" label="City">
              <Button
                id="q-city"
                type="button"
                variant="outline"
                className="h-11 w-full justify-between"
                onClick={() => setCityOpen(true)}
              >
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
            <label className="flex items-start gap-2 text-sm text-muted-foreground">
              <input
                type="checkbox"
                checked={d.consent}
                onChange={(e) => set("consent", e.target.checked)}
                className="mt-0.5 size-4 accent-[var(--primary)]"
              />
              <span>
                I agree to InnerSpacio storing my details and room photos to prepare this estimate and contact me
                about it.
              </span>
            </label>
          </div>
        </section>
      )}

      {error && (
        <p role="alert" data-error className="mt-5 text-sm text-destructive">
          {error}
        </p>
      )}

      <div data-no-anim className="sticky bottom-0 -mx-5 mt-10 flex items-center justify-between border-t border-border/70 bg-background/90 px-5 py-4 backdrop-blur-md">
        <Button
          variant="ghost"
          onClick={() => {
            setError(null);
            set("step", Math.max(0, d.step - 1));
          }}
          disabled={d.step === 0 || starting}
        >
          Back
        </Button>
        <Button size="lg" className="min-w-40 gap-2" onClick={() => void next()} disabled={starting}>
          {starting && <Loader2 className="size-4 animate-spin" />}
          {d.step === LAST_STEP ? "Submit" : "Next"}
        </Button>
      </div>

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
        <ol className="mx-auto flex max-w-3xl gap-3 px-5 py-4" aria-label="Progress">
          {STEPS.map((s, i) => (
            <li key={s} className="flex-1" aria-current={i === step ? "step" : undefined}>
              <div className="h-px overflow-hidden bg-foreground/15">
                <div
                  data-seg
                  className="h-0.5 origin-left bg-saffron"
                  style={{ transform: `scaleX(${i <= step ? 1 : 0})` }}
                />
              </div>
              <span
                className={cn(
                  "font-caps mt-2 flex items-center gap-1.5 text-[0.7rem] tracking-[0.14em] uppercase transition-colors",
                  i === step ? "text-foreground" : "text-muted-foreground"
                )}
              >
                <span className="tabular-nums">{String(i + 1).padStart(2, "0")}</span>
                <span className="hidden sm:inline">{s}</span>
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
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  );
}

function ChoiceCard({
  selected,
  onClick,
  children,
  block,
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
  block?: boolean;
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
        selected ? "border-foreground bg-secondary/70" : "border-border hover:-translate-y-0.5 hover:border-foreground/50",
        block && "py-5"
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
  onFiles,
  onIdeas,
}: {
  room: RoomDraft;
  files: File[];
  onFiles: (f: File[]) => void;
  onIdeas: (v: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const urls = useMemo(() => files.map((f) => URL.createObjectURL(f)), [files]);
  useEffect(() => () => urls.forEach((x) => URL.revokeObjectURL(x)), [urls]);

  return (
    <div className="rounded-3xl border border-border bg-card p-6">
      <h2 className="display text-[1.7rem]">{room.label}</h2>
      <div className="mt-3 flex flex-wrap gap-2">
        {urls.map((u, i) => (
          <div key={u} className="relative size-28 overflow-hidden rounded-2xl border border-border">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={u} alt={`${room.label} photo ${i + 1}`} className="size-full object-cover" />
            <button
              type="button"
              aria-label="Remove photo"
              onClick={() => onFiles(files.filter((_, j) => j !== i))}
              className="absolute top-1 right-1 grid size-6 place-items-center rounded-full bg-background/90"
            >
              <X className="size-3.5" />
            </button>
          </div>
        ))}
        {files.length < MAX_PHOTOS_PER_ROOM && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="grid size-28 place-items-center rounded-2xl border border-dashed border-foreground/30 text-muted-foreground transition-colors duration-300 hover:border-foreground hover:bg-secondary hover:text-foreground"
          >
            <span className="flex flex-col items-center gap-1 text-xs">
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
      <Label htmlFor={`ideas-${room.key}`} className="font-caps mt-5 block text-[0.72rem] tracking-[0.12em] text-muted-foreground uppercase">
        What do you have in mind? (optional)
      </Label>
      <Textarea
        id={`ideas-${room.key}`}
        className="mt-1.5"
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
      <DialogContent className="max-h-[80vh] overflow-hidden p-0 sm:max-w-sm">
        <DialogHeader className="px-4 pt-4">
          <DialogTitle>Select city</DialogTitle>
        </DialogHeader>
        <div className="relative px-4">
          <Search className="absolute top-2.5 left-7 size-4 text-muted-foreground" />
          <Input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search city"
            className="pl-8"
            aria-label="Search city"
          />
        </div>
        <ul className="max-h-[50vh] overflow-y-auto border-t border-border">
          {list.map((c) => (
            <li key={c}>
              <button
                type="button"
                onClick={() => onPick(c)}
                className="w-full border-b border-border px-4 py-3 text-left text-sm hover:bg-muted"
              >
                {c}
              </button>
            </li>
          ))}
          {list.length === 0 && <li className="px-4 py-6 text-sm text-muted-foreground">No match.</li>}
        </ul>
      </DialogContent>
    </Dialog>
  );
}
