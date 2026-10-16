"use client";

import { useMemo, useState, useTransition } from "react";
import Image from "next/image";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { BeforeAfterSlider } from "@/components/present/before-after-slider";
import { ConceptFullscreenViewer } from "@/components/present/concept-fullscreen-viewer";
import { EstimateCard } from "@/components/present/estimate-card";
import { FeedbackDialog } from "@/components/present/feedback-dialog";
import { submitClientDecisionAction } from "@/lib/actions/presentation-client";
import { ROOM_TYPES } from "@/lib/types";
import type { ClientLinkConcept, ClientLinkProject, ClientLinkRoom } from "@/lib/presentation/client-dto";
import { CheckCircle2, Expand, Printer, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/layout/logo";
import { BrandReveal } from "@/components/motion/brand-reveal";
import { SmoothScroll } from "@/components/motion/smooth-scroll";

export function PresentationExperience({
  token,
  data,
  readOnly = false,
}: {
  token: string;
  data: ClientLinkProject;
  /** Designer preview mode: renders the real view, but client actions (select/approve/accept/feedback) are disabled rather than wired to a token that may not correspond to a real, shareable link. */
  readOnly?: boolean;
}) {
  const [rooms, setRooms] = useState<ClientLinkRoom[]>(data.rooms);
  const [activeRoomId, setActiveRoomId] = useState<string | undefined>(data.rooms[0]?.roomId);
  const [activeConceptId, setActiveConceptId] = useState<string | "original">("original");
  const [fullscreenIndex, setFullscreenIndex] = useState<number | null>(null);
  const [isPending, startTransition] = useTransition();

  const activeRoom = rooms.find((r) => r.roomId === activeRoomId) ?? rooms[0];

  const progress = useMemo(() => {
    const totalRooms = rooms.length;
    const decidedRooms = rooms.filter((r) => r.concepts.some((c) => c.isSelected)).length;
    return totalRooms === 0 ? 0 : Math.round((decidedRooms / totalRooms) * 100);
  }, [rooms]);

  function updateRoom(roomId: string, updater: (room: ClientLinkRoom) => ClientLinkRoom) {
    setRooms((prev) => prev.map((r) => (r.roomId === roomId ? updater(r) : r)));
  }

  function selectConcept(room: ClientLinkRoom, concept: ClientLinkConcept) {
    if (readOnly) return;
    startTransition(async () => {
      const result = await submitClientDecisionAction({
        token,
        decisionType: "concept_selected",
        roomId: room.roomId,
        conceptId: concept.id,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      updateRoom(room.roomId, (r) => ({
        ...r,
        concepts: r.concepts.map((c) => ({ ...c, isSelected: c.id === concept.id })),
      }));
      toast.success("Preference saved.");
    });
  }

  function approveConcept(room: ClientLinkRoom, concept: ClientLinkConcept) {
    if (readOnly) return;
    startTransition(async () => {
      const result = await submitClientDecisionAction({
        token,
        decisionType: "concept_approved",
        roomId: room.roomId,
        conceptId: concept.id,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      updateRoom(room.roomId, (r) => ({
        ...r,
        concepts: r.concepts.map((c) => (c.id === concept.id ? { ...c, isApproved: true } : c)),
      }));
      toast.success("Concept approved for the next stage.");
    });
  }

  if (!activeRoom) {
    return (
      <div className="flex min-h-screen items-center justify-center px-6 text-center">
        <p className="text-sm text-muted-foreground">
          There&apos;s nothing to show here yet — check back once your designer has added rooms.
        </p>
      </div>
    );
  }

  const roomTypeLabel = ROOM_TYPES.find((t) => t.value === activeRoom.roomType)?.label ?? activeRoom.roomType;
  const activeConcept = activeRoom.concepts.find((c) => c.id === activeConceptId);

  return (
    <SmoothScroll>
    {/* Night: the presentation is a dark stage so the renders carry the room. Print falls back to paper. */}
    <div className="dark min-h-screen bg-background pb-28 text-foreground print:pb-0">
      {!readOnly && <BrandReveal name={data.clientFirstName} />}
      {readOnly && (
        <div className="bg-accent px-4 py-2 text-center text-xs font-medium text-accent-foreground print:hidden">
          Designer preview — this is exactly what your client sees, but selections and feedback
          here are not saved.
        </div>
      )}
      {/* Header */}
      <header className="border-b border-border/60 px-5 py-5 print:hidden md:px-10">
        <div className="mx-auto flex max-w-[88rem] flex-wrap items-center justify-between gap-3">
          <Logo studio={false} size="sm" />
          <Button variant="outline" size="sm" onClick={() => window.print()} className="gap-2">
            <Printer className="size-4" /> Print
          </Button>
        </div>
      </header>

      <div className="mx-auto max-w-[88rem] px-5 py-12 md:px-10 md:py-20">
        {/* Welcome + progress */}
        <div className="mb-12 md:mb-16">
          <p className="eyebrow">
            {data.clientFirstName ? `Welcome, ${data.clientFirstName}` : "Welcome"}
            {data.location ? ` · ${data.location}` : ""}
          </p>
          <h1 className="display display-lg mt-6 max-w-[18ch] text-foreground">{data.projectTitle}</h1>
          <p className="mt-6 max-w-xl text-[1.05rem] leading-relaxed text-muted-foreground">
            Here&apos;s your personalized design presentation. Explore each room, compare concepts
            against your current space, and let us know what you think.
          </p>
          {rooms.length > 1 && (
            <div className="mt-4 flex items-center gap-3">
              <Progress value={progress} className="h-px w-48 bg-foreground/20" />
              <span className="font-caps text-[0.72rem] tracking-[0.14em] text-muted-foreground uppercase">{progress}% of rooms decided</span>
            </div>
          )}
        </div>

        {/* Room tabs */}
        {rooms.length > 1 && (
          <div className="mb-6 no-scrollbar flex gap-2 overflow-x-auto pb-1 print:hidden">
            {rooms.map((room) => (
              <button
                key={room.roomId}
                onClick={() => {
                  setActiveRoomId(room.roomId);
                  setActiveConceptId("original");
                }}
                className={cn(
                  "font-caps shrink-0 rounded-full border px-5 py-2.5 text-[0.8rem] tracking-[0.12em] uppercase transition-colors duration-300",
                  room.roomId === activeRoom.roomId
                    ? "border-foreground bg-foreground text-background"
                    : "border-foreground/25 text-muted-foreground hover:border-foreground hover:text-foreground"
                )}
              >
                {room.roomName}
                {room.concepts.some((c) => c.isSelected) && (
                  <CheckCircle2 className="ml-1.5 inline size-3.5 align-text-bottom" />
                )}
              </button>
            ))}
          </div>
        )}

        <p className="eyebrow mb-4">{roomTypeLabel}</p>

        {/* Concept switcher */}
        <div className="mb-4 no-scrollbar flex gap-2 overflow-x-auto pb-1 print:hidden">
          <button
            onClick={() => setActiveConceptId("original")}
            className={cn(
              "font-caps shrink-0 rounded-full border px-4 py-2 text-[0.75rem] tracking-[0.12em] uppercase transition-colors duration-300",
              activeConceptId === "original"
                ? "border-saffron bg-saffron text-[#211812]"
                : "border-foreground/25 text-muted-foreground hover:border-foreground hover:text-foreground"
            )}
          >
            Your room today
          </button>
          {activeRoom.concepts.map((concept) => (
            <button
              key={concept.id}
              onClick={() => setActiveConceptId(concept.id)}
              className={cn(
                "font-caps shrink-0 rounded-full border px-4 py-2 text-[0.75rem] tracking-[0.12em] uppercase transition-colors duration-300",
                activeConceptId === concept.id
                  ? "border-saffron bg-saffron text-[#211812]"
                  : "border-foreground/25 text-muted-foreground hover:border-foreground hover:text-foreground"
              )}
            >
              {concept.title}
              {concept.isSelected && <CheckCircle2 className="ml-1.5 inline size-3.5 align-text-bottom" />}
            </button>
          ))}
        </div>

        {/* Main viewer */}
        <div className="relative">
          {activeConceptId === "original" || !activeConcept ? (
            activeRoom.originalPhotoUrl ? (
              <button
                onClick={() => setFullscreenIndex(null)}
                className="relative block aspect-[4/3] w-full overflow-hidden rounded-3xl bg-muted sm:aspect-[16/10]"
              >
                <Image
                  src={activeRoom.originalPhotoUrl}
                  alt={activeRoom.roomName}
                  fill
                  unoptimized
                  className="object-cover"
                />
              </button>
            ) : (
              <div className="flex aspect-[4/3] w-full items-center justify-center rounded-2xl border border-dashed border-border text-sm text-muted-foreground sm:aspect-[16/10]">
                No photo uploaded for this room yet.
              </div>
            )
          ) : (
            <div className="space-y-4">
              <div
                className="group relative cursor-zoom-in"
                onClick={() =>
                  setFullscreenIndex(activeRoom.concepts.findIndex((c) => c.id === activeConcept.id))
                }
              >
                {activeRoom.originalPhotoUrl ? (
                  <BeforeAfterSlider
                    beforeSrc={activeRoom.originalPhotoUrl}
                    afterSrc={activeConcept.imageUrl}
                    beforeLabel="Your room"
                    afterLabel={activeConcept.title}
                  />
                ) : (
                  <div className="relative aspect-[4/3] w-full overflow-hidden rounded-3xl bg-muted sm:aspect-[16/10]">
                    <Image
                      src={activeConcept.imageUrl}
                      alt={activeConcept.title}
                      fill
                      unoptimized
                      className="object-cover"
                    />
                  </div>
                )}
                <div className="pointer-events-none absolute right-3 bottom-3 flex items-center gap-1.5 rounded-full bg-background/90 px-3 py-1.5 text-xs text-foreground opacity-0 transition-opacity group-hover:opacity-100 print:hidden">
                  <Expand className="size-3.5" /> Full screen
                </div>
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
              </div>

              <div>
                <h2 className="display display-md text-foreground">{activeConcept.title}</h2>
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

                <div className="mt-5 flex flex-wrap gap-3 print:hidden">
                  <Button
                    size="lg"
                    variant={activeConcept.isSelected ? "secondary" : "default"}
                    disabled={isPending || readOnly}
                    onClick={() => selectConcept(activeRoom, activeConcept)}
                    className="gap-2"
                  >
                    {activeConcept.isSelected ? <CheckCircle2 className="size-4" /> : <Sparkles className="size-4" />}
                    {activeConcept.isSelected ? "Your preferred concept" : "Select as preferred"}
                  </Button>
                  <Button
                    size="lg"
                    variant="outline"
                    disabled={isPending || activeConcept.isApproved || readOnly}
                    onClick={() => approveConcept(activeRoom, activeConcept)}
                    className="gap-2"
                  >
                    {activeConcept.isApproved && <CheckCircle2 className="size-4" />}
                    {activeConcept.isApproved ? "Approved for next stage" : "Approve for next stage"}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>

        {activeRoom.concepts.length === 0 && activeConceptId === "original" && (
          <p className="mt-4 text-sm text-muted-foreground">
            Design concepts for this room are still being prepared.
          </p>
        )}

        <p className="mt-8 border-t border-border pt-4 text-xs leading-relaxed text-muted-foreground">
          Generated visuals are illustrative design concepts, subject to site measurements, material
          selection and technical validation — they are not construction drawings or a guarantee of
          exact final appearance.
        </p>

        {activeRoom.estimate && (
          <div className="mt-8">
            <EstimateCard
              token={token}
              roomId={activeRoom.roomId}
              estimate={activeRoom.estimate}
              readOnly={readOnly}
              onAccepted={() =>
                updateRoom(activeRoom.roomId, (r) => ({
                  ...r,
                  estimate: r.estimate ? { ...r.estimate, isAccepted: true } : r.estimate,
                }))
              }
            />
          </div>
        )}
      </div>

      {/* Floating feedback button */}
      {!readOnly && (
        <div className="fixed bottom-6 right-4 print:hidden sm:right-6">
          <FeedbackDialog
            token={token}
            roomId={activeRoom.roomId}
            roomName={activeRoom.roomName}
            conceptId={activeConcept?.id}
            conceptTitle={activeConcept?.title}
          />
        </div>
      )}

      {fullscreenIndex !== null && activeRoom.concepts.length > 0 && (
        <ConceptFullscreenViewer
          concepts={activeRoom.concepts}
          activeIndex={fullscreenIndex}
          originalPhotoUrl={activeRoom.originalPhotoUrl}
          onClose={() => setFullscreenIndex(null)}
          onNavigate={setFullscreenIndex}
        />
      )}
    </div>
    </SmoothScroll>
  );
}
