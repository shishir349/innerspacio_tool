"use client";

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
  TIER_RANGE_LAKH,
  type Bhk,
  type HomeSize,
  type PackageTier,
  type QuoteRoomType,
} from "@/lib/quote/constants";

const STEPS = ["Home", "Rooms", "Photos", "Package", "Details"] as const;

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

/** Downscale to ≤1600px JPEG client-side: smaller upload, works on slow phones. */
async function shrinkImage(file: File): Promise<File> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob: Blob | null = await new Promise((r) => canvas.toBlob(r, "image/jpeg", 0.85));
    if (!blob) return file;
    return new File([blob], file.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" });
  } catch {
    return file; // e.g. HEIC on a browser that can't decode it — server validates anyway
  }
}

export function QuoteWizard() {
  const router = useRouter();
  const [d, setD] = useState<Draft>(EMPTY);
  // Photos can't live in sessionStorage; they stay in memory for this visit.
  const [photos, setPhotos] = useState<Record<string, File[]>>({});
  const [error, setError] = useState<string | null>(null);
  const [cityOpen, setCityOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [progress, setProgress] = useState<{ label: string; state: "wait" | "run" | "done" | "fail"; msg?: string }[]>([]);
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
    if (step === 2) {
      const missing = rooms.find((r) => (photos[r.key]?.length ?? 0) === 0);
      if (missing) return `Add a photo of your ${missing.label.toLowerCase()}.`;
    }
    if (step === 3 && !d.tier) return "Please pick a package.";
    if (step === 4) {
      if (d.name.trim().length < 2) return "Please enter your name.";
      if (!/^\S+@\S+\.\S+$/.test(d.email)) return "Enter a valid email address.";
      if (!/^\+?[0-9][0-9\s-]{7,16}$/.test(d.phone.trim())) return "Enter a valid phone number.";
      if (!d.city) return "Please select your city.";
      if (!d.consent) return "Please accept the privacy terms to continue.";
    }
    return null;
  }

  function next() {
    const problem = validate(d.step);
    setError(problem);
    if (problem) return;
    if (d.step === STEPS.length - 1) void submit();
    else set("step", d.step + 1);
  }

  async function submit() {
    setSubmitting(true);
    setError(null);
    setProgress(rooms.map((r) => ({ label: r.label, state: "wait" })));
    try {
      const res = await fetch("/api/public/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bhk: d.bhk,
          homeSize: d.bhk && SIZED_BHKS.includes(d.bhk) ? d.homeSize : undefined,
          packageTier: d.tier,
          city: d.city,
          name: d.name.trim(),
          email: d.email.trim(),
          phone: d.phone.trim(),
          whatsappOptIn: d.whatsapp,
          consent: d.consent,
          website: honeypot.current?.value ?? "",
          rooms: rooms.map((r) => ({ roomType: r.roomType, ideas: r.ideas || undefined })),
        }),
      });
      const lead = await res.json();
      if (!res.ok) throw new Error(lead.error ?? "Could not submit. Please try again.");

      // One request per room: each can take up to ~a minute to generate.
      for (let i = 0; i < rooms.length; i++) {
        const target = lead.rooms[i];
        const files = photos[rooms[i].key] ?? [];
        setProgress((p) => p.map((x, j) => (j === i ? { ...x, state: "run" } : x)));
        const form = new FormData();
        for (const f of files) form.append("photos", await shrinkImage(f));
        let msg: string | undefined;
        // Generation can run ~60s+; a proxy may cut the connection while the server
        // finishes. The server is idempotent + de-duplicates, so retrying is safe.
        for (let attempt = 0; attempt < 3; attempt++) {
          msg = undefined;
          try {
            const r = await fetch(`/api/public/quote/${lead.leadId}/rooms/${target.id}`, {
              method: "POST",
              headers: { "x-quote-token": lead.token },
              body: form,
            });
            if (r.ok) break;
            const body = await r.json().catch(() => null);
            msg = body?.error ?? "Could not generate this image.";
            if (![502, 503, 504].includes(r.status)) break; // 4xx: retrying won't help
          } catch {
            msg = "Network problem — your estimate is still saved.";
          }
          await new Promise((res) => setTimeout(res, 4000));
        }
        setProgress((p) => p.map((x, j) => (j === i ? { ...x, state: msg ? "fail" : "done", msg } : x)));
      }
      router.push(`/get-quote/result/${lead.token}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
      setSubmitting(false);
    }
  }

  if (submitting) {
    return (
      <Shell step={STEPS.length - 1}>
        <h1 className="editorial-heading text-2xl">Designing your rooms…</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          This takes up to a minute per room. Please keep this page open.
        </p>
        <ul className="mt-6 space-y-3">
          {progress.map((p) => (
            <li key={p.label} className="flex items-start gap-3 rounded-lg border border-border bg-card px-4 py-3">
              <span className="mt-0.5">
                <Pop key={p.state}>
                  {p.state === "run" && <Loader2 className="size-4 animate-spin text-primary" />}
                  {p.state === "done" && <Check className="size-4 text-primary" />}
                  {p.state === "fail" && <X className="size-4 text-destructive" />}
                  {p.state === "wait" && <span className="block size-4 rounded-full border border-border" />}
                </Pop>
              </span>
              <span className="text-sm">
                {p.label}
                {p.msg && <span className="block text-xs text-destructive">{p.msg}</span>}
              </span>
            </li>
          ))}
        </ul>
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
                  className="flex items-center justify-between rounded-lg border border-border bg-card px-4 py-3"
                >
                  <span className="text-sm font-medium">{t.label}</span>
                  <div className="flex items-center gap-3">
                    <Stepper
                      label={`Remove ${t.label}`}
                      disabled={n === 0}
                      onClick={() => bump(t.value, -1)}
                    >
                      <Minus className="size-4" />
                    </Stepper>
                    <span className="w-4 text-center text-sm tabular-nums">
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

      {d.step === 2 && (
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

      {d.step === 3 && (
        <section>
          <Heading title="Pick your package" sub="You can change this later with your designer." />
          <div className="mt-6 grid gap-3">
            {PACKAGE_TIERS.map((t) => {
              const info = TIER_INFO[t];
              const r = TIER_RANGE_LAKH[t];
              return (
                <ChoiceCard key={t} selected={d.tier === t} onClick={() => set("tier", t)} block>
                  <span className="flex items-baseline justify-between">
                    <span className="editorial-heading text-lg">{info.label}</span>
                    <span className="text-xs text-muted-foreground">
                      typically ₹{r.min}–{r.max}L
                    </span>
                  </span>
                  <span className="mt-1 block text-sm font-normal text-muted-foreground">{info.blurb}</span>
                  <span className="mt-3 block space-y-1">
                    {info.bullets.map((b) => (
                      <span key={b} className="flex items-center gap-2 text-sm font-normal">
                        <Check className="size-3.5 text-primary" />
                        {b}
                      </span>
                    ))}
                  </span>
                </ChoiceCard>
              );
            })}
          </div>
        </section>
      )}

      {d.step === 4 && (
        <section>
          <Heading title="Your estimate is almost ready" sub="Where should we send your designs and estimate?" />
          <div className="mt-6 space-y-4">
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
                className="h-10 w-full justify-between font-normal"
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

      <div data-no-anim className="sticky bottom-0 -mx-4 mt-8 flex items-center justify-between border-t border-border bg-background/95 px-4 py-3 backdrop-blur">
        <Button
          variant="ghost"
          onClick={() => {
            setError(null);
            set("step", Math.max(0, d.step - 1));
          }}
          disabled={d.step === 0}
        >
          Back
        </Button>
        <Button size="lg" className="min-w-32" onClick={next}>
          {d.step === STEPS.length - 1 ? "See my estimate" : "Next"}
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
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-xl items-center justify-between px-4 py-3">
          <span className="editorial-heading text-lg italic">InnerSpacio</span>
          <span className="text-xs text-muted-foreground">
            Step {Math.min(step + 1, STEPS.length)} of {STEPS.length}
          </span>
        </div>
        <ol className="mx-auto flex max-w-xl gap-1 px-4 pb-3" aria-label="Progress">
          {STEPS.map((s, i) => (
            <li key={s} className="flex-1">
              <div className="h-1 overflow-hidden rounded-full bg-border">
                <div
                  data-seg
                  className="h-full origin-left rounded-full bg-primary"
                  style={{ transform: `scaleX(${i <= step ? 1 : 0})` }}
                />
              </div>
              <span
                className={cn(
                  "mt-1 block text-[10px] uppercase tracking-wider",
                  i === step ? "text-foreground" : "text-muted-foreground"
                )}
              >
                {s}
              </span>
            </li>
          ))}
        </ol>
      </header>
      <main className="mx-auto max-w-xl px-4 pt-8 pb-4">{children}</main>
    </div>
  );
}

function Heading({ title, sub }: { title: string; sub: string }) {
  return (
    <div>
      <h1 className="editorial-heading text-2xl leading-tight">{title}</h1>
      <p className="mt-1.5 text-sm text-muted-foreground">{sub}</p>
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
        "w-full rounded-lg border bg-card px-4 py-3.5 text-left text-sm font-medium transition-colors",
        "focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
        selected ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-border hover:bg-muted",
        block && "py-4"
      )}
    >
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
      className="grid size-11 place-items-center rounded-full bg-primary text-primary-foreground transition-opacity disabled:opacity-35"
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
    <div className="rounded-xl border border-border bg-card p-4">
      <h2 className="text-sm font-medium">{room.label}</h2>
      <div className="mt-3 flex flex-wrap gap-2">
        {urls.map((u, i) => (
          <div key={u} className="relative size-24 overflow-hidden rounded-lg border border-border">
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
            className="grid size-24 place-items-center rounded-lg border border-dashed border-border text-muted-foreground hover:bg-muted"
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
      <Label htmlFor={`ideas-${room.key}`} className="mt-4 block text-xs text-muted-foreground">
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
