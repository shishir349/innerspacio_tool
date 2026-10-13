"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import Image from "next/image";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { selectConceptAction } from "@/lib/actions/projects";
import { formatInr } from "@/lib/format";
import { ROOM_TYPES } from "@/lib/types";
import type { ClientPresentationProject, ClientPresentationRoom } from "@/lib/types";
import { Printer, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

export function PresentationView({
  presentation,
  activeRoomId,
}: {
  presentation: ClientPresentationProject;
  activeRoomId: string;
}) {
  const room =
    presentation.rooms.find((r) => r.roomId === activeRoomId) ?? presentation.rooms[0];
  const [view, setView] = useState<"original" | string>("original");
  const [isSelecting, startSelecting] = useTransition();
  const [room_, setRoom] = useState<ClientPresentationRoom>(room);

  const roomTypeLabel = ROOM_TYPES.find((t) => t.value === room_.roomType)?.label ?? room_.roomType;
  const activeConcept = room_.concepts.find((c) => c.id === view);

  function selectConcept(conceptId: string) {
    startSelecting(async () => {
      const result = await selectConceptAction(presentation.projectId, room_.roomId, conceptId);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setRoom({
        ...room_,
        selectedConceptId: conceptId,
        concepts: room_.concepts.map((c) => ({ ...c, isSelected: c.id === conceptId })),
      });
      toast.success("Concept marked as selected.");
    });
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="flex items-center justify-between border-b border-border px-6 py-4 print:hidden">
        <div>
          <p className="editorial-heading text-xl italic text-foreground">InnerSpacio</p>
          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
            Your space, your story
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => window.print()} className="gap-2">
            <Printer className="size-4" /> Print
          </Button>
          <Button
            variant="ghost"
            size="sm"
            render={<Link href={`/design-studio/${presentation.projectId}/${room_.roomId}`} />}
          >
            Exit presentation
          </Button>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-6 py-8">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm text-muted-foreground">{presentation.clientName} · {presentation.location}</p>
            <h1 className="editorial-heading text-4xl text-foreground">{presentation.projectTitle}</h1>
            <p className="mt-1 text-lg text-muted-foreground">{room_.roomName} — {roomTypeLabel}</p>
          </div>
          {presentation.rooms.length > 1 && (
            <div className="flex gap-2 print:hidden">
              {presentation.rooms.map((r) => (
                <Link
                  key={r.roomId}
                  href={`/presentation/${presentation.projectId}/${r.roomId}`}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-sm transition-colors",
                    r.roomId === room_.roomId
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border text-muted-foreground hover:bg-accent/50"
                  )}
                >
                  {r.roomName}
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className="flex gap-2 overflow-x-auto pb-2 print:hidden">
          <button
            onClick={() => setView("original")}
            className={cn(
              "shrink-0 rounded-full border px-4 py-1.5 text-sm transition-colors",
              view === "original"
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border text-muted-foreground hover:bg-accent/50"
            )}
          >
            Original Room
          </button>
          {room_.concepts.map((c) => (
            <button
              key={c.id}
              onClick={() => setView(c.id)}
              className={cn(
                "shrink-0 rounded-full border px-4 py-1.5 text-sm transition-colors",
                view === c.id
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border text-muted-foreground hover:bg-accent/50"
              )}
            >
              {c.title}
              {c.isSelected && " ✓"}
            </button>
          ))}
        </div>

        <div className="mt-4 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
          <div className="relative aspect-[4/3] overflow-hidden rounded-2xl border border-border bg-muted shadow-sm">
            {view === "original" ? (
              room_.primaryPhotoUrl ? (
                <Image src={room_.primaryPhotoUrl} alt={room_.roomName} fill unoptimized className="object-cover" />
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                  No photo uploaded yet.
                </div>
              )
            ) : activeConcept ? (
              <>
                <Image
                  src={activeConcept.imageUrl}
                  alt={activeConcept.title}
                  fill
                  unoptimized
                  className="object-cover"
                />
                <Badge
                  className={cn(
                    "absolute left-3 top-3",
                    activeConcept.status === "demo"
                      ? "bg-background/90 text-foreground"
                      : "bg-primary text-primary-foreground"
                  )}
                >
                  {activeConcept.status === "demo" ? "Illustrative demo concept" : "AI-generated concept"}
                </Badge>
              </>
            ) : null}
          </div>

          <div className="space-y-5">
            {view === "original" ? (
              <div>
                <h2 className="editorial-heading text-2xl text-foreground">The Room Today</h2>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  Dimensions: {room_.dimensions.length ?? "—"} × {room_.dimensions.width ?? "—"}{" "}
                  {room_.dimensions.unit} (ceiling {room_.dimensions.ceilingHeight ?? "—"} {room_.dimensions.unit})
                </p>
              </div>
            ) : activeConcept ? (
              <div>
                <h2 className="editorial-heading text-2xl text-foreground">{activeConcept.title}</h2>
                <p className="text-sm text-muted-foreground">{activeConcept.style}</p>
                <p className="mt-3 text-sm leading-relaxed text-foreground/90">{activeConcept.description}</p>
                {activeConcept.keyChanges.length > 0 && (
                  <div className="mt-4">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Key proposed changes
                    </p>
                    <ul className="mt-2 list-disc space-y-1 pl-4 text-sm text-foreground/90">
                      {activeConcept.keyChanges.map((c, i) => (
                        <li key={i}>{c}</li>
                      ))}
                    </ul>
                  </div>
                )}
                <Button
                  className="mt-4 gap-2 print:hidden"
                  variant={activeConcept.isSelected ? "secondary" : "default"}
                  disabled={isSelecting}
                  onClick={() => selectConcept(activeConcept.id)}
                >
                  {activeConcept.isSelected ? (
                    <>
                      <CheckCircle2 className="size-4" /> Client&apos;s Selection
                    </>
                  ) : (
                    "Mark as Client's Selection"
                  )}
                </Button>
              </div>
            ) : null}

            {room_.estimateSummary && (
              <div className="rounded-xl border border-border bg-secondary/40 p-5">
                <p className="editorial-heading text-lg text-foreground">Preliminary Estimate</p>
                <ul className="mt-3 space-y-1.5 text-sm text-foreground/90">
                  {room_.estimateSummary.lineItems.map((li) => (
                    <li key={li.id} className="flex justify-between gap-3">
                      <span>
                        {li.name} <span className="text-muted-foreground">× {li.quantity} {li.unit}</span>
                      </span>
                    </li>
                  ))}
                </ul>
                <div className="mt-3 space-y-1 border-t border-border pt-3 text-sm">
                  <div className="flex justify-between text-muted-foreground">
                    <span>Subtotal (incl. contingency & studio margin)</span>
                    <span>{formatInr(room_.estimateSummary.subtotalBeforeGst)}</span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>GST ({room_.estimateSummary.gstPercent}%)</span>
                    <span>{formatInr(room_.estimateSummary.gstAmount)}</span>
                  </div>
                  <div className="flex justify-between pt-1 text-base font-semibold text-foreground">
                    <span>Total estimate</span>
                    <span>{formatInr(room_.estimateSummary.totalClientEstimate)}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <p className="mt-10 border-t border-border pt-4 text-xs leading-relaxed text-muted-foreground">
          Generated visuals are illustrative design concepts, subject to site measurements,
          material selection and technical validation. This is a preliminary estimate, not a final
          quotation — final scope, specifications and pricing will be confirmed after a site visit.
        </p>
      </div>
    </div>
  );
}
