"use client";

import { useEffect } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BeforeAfterSlider } from "@/components/present/before-after-slider";
import { X, ChevronLeft, ChevronRight } from "lucide-react";
import type { ClientLinkConcept } from "@/lib/presentation/client-dto";

export function ConceptFullscreenViewer({
  concepts,
  activeIndex,
  originalPhotoUrl,
  onClose,
  onNavigate,
}: {
  concepts: ClientLinkConcept[];
  activeIndex: number;
  originalPhotoUrl?: string;
  onClose: () => void;
  onNavigate: (index: number) => void;
}) {
  const concept = concepts[activeIndex];

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") onNavigate((activeIndex - 1 + concepts.length) % concepts.length);
      if (e.key === "ArrowRight") onNavigate((activeIndex + 1) % concepts.length);
    }
    window.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
    };
  }, [activeIndex, concepts.length, onClose, onNavigate]);

  if (!concept) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background/98 backdrop-blur">
      <div className="flex items-center justify-between px-4 py-3 sm:px-6">
        <Badge
          className={
            concept.status === "demo"
              ? "bg-muted text-muted-foreground"
              : "bg-primary text-primary-foreground"
          }
        >
          {concept.status === "demo" ? "Illustrative demo concept" : "AI-generated concept"}
        </Badge>
        <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close full-screen view">
          <X className="size-5" />
        </Button>
      </div>

      <div className="relative flex-1 px-4 pb-4 sm:px-6">
        {originalPhotoUrl ? (
          <BeforeAfterSlider
            beforeSrc={originalPhotoUrl}
            afterSrc={concept.imageUrl}
            beforeLabel="Your room"
            afterLabel={concept.title}
          />
        ) : (
          <div className="relative h-full w-full overflow-hidden rounded-2xl bg-muted">
            <Image src={concept.imageUrl} alt={concept.title} fill unoptimized className="object-contain" />
          </div>
        )}

        {concepts.length > 1 && (
          <>
            <button
              onClick={() => onNavigate((activeIndex - 1 + concepts.length) % concepts.length)}
              aria-label="Previous concept"
              className="absolute left-6 top-1/2 flex size-11 -translate-y-1/2 items-center justify-center rounded-full bg-background/90 text-foreground shadow-md hover:bg-background"
            >
              <ChevronLeft className="size-5" />
            </button>
            <button
              onClick={() => onNavigate((activeIndex + 1) % concepts.length)}
              aria-label="Next concept"
              className="absolute right-6 top-1/2 flex size-11 -translate-y-1/2 items-center justify-center rounded-full bg-background/90 text-foreground shadow-md hover:bg-background"
            >
              <ChevronRight className="size-5" />
            </button>
          </>
        )}
      </div>

      <div className="px-4 pb-6 text-center sm:px-6">
        <p className="editorial-heading text-xl text-foreground">{concept.title}</p>
        <p className="text-sm text-muted-foreground">{concept.style}</p>
      </div>
    </div>
  );
}
