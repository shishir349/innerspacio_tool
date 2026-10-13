"use client";

import { useCallback, useRef, useState } from "react";
import Image from "next/image";
import { MoveHorizontal } from "lucide-react";

export function BeforeAfterSlider({
  beforeSrc,
  afterSrc,
  beforeLabel = "Before",
  afterLabel = "After",
}: {
  beforeSrc: string;
  afterSrc: string;
  beforeLabel?: string;
  afterLabel?: string;
}) {
  const [position, setPosition] = useState(50);
  const containerRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);

  const updateFromClientX = useCallback((clientX: number) => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const pct = ((clientX - rect.left) / rect.width) * 100;
    setPosition(Math.min(100, Math.max(0, pct)));
  }, []);

  function onPointerDown(e: React.PointerEvent) {
    draggingRef.current = true;
    (e.target as Element).setPointerCapture(e.pointerId);
    updateFromClientX(e.clientX);
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!draggingRef.current) return;
    updateFromClientX(e.clientX);
  }
  function onPointerUp() {
    draggingRef.current = false;
  }
  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowLeft") setPosition((p) => Math.max(0, p - 5));
    if (e.key === "ArrowRight") setPosition((p) => Math.min(100, p + 5));
    if (e.key === "Home") setPosition(0);
    if (e.key === "End") setPosition(100);
  }

  return (
    <div
      ref={containerRef}
      className="relative aspect-[4/3] w-full touch-none overflow-hidden rounded-2xl bg-muted select-none sm:aspect-[16/10]"
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    >
      <Image src={beforeSrc} alt={beforeLabel} fill unoptimized className="object-cover" draggable={false} />
      <span className="absolute left-3 top-3 rounded-full bg-background/85 px-3 py-1 text-xs font-medium text-foreground">
        {beforeLabel}
      </span>

      <div
        className="absolute inset-0 overflow-hidden"
        style={{ clipPath: `inset(0 ${100 - position}% 0 0)` }}
      >
        <Image src={afterSrc} alt={afterLabel} fill unoptimized className="object-cover" draggable={false} />
        <span className="absolute right-3 top-3 rounded-full bg-primary/90 px-3 py-1 text-xs font-medium text-primary-foreground">
          {afterLabel}
        </span>
      </div>

      <div
        role="slider"
        tabIndex={0}
        aria-label={`Comparison between ${beforeLabel} and ${afterLabel}`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(position)}
        onKeyDown={onKeyDown}
        onPointerDown={onPointerDown}
        className="absolute top-0 bottom-0 flex w-10 -translate-x-1/2 cursor-ew-resize items-center justify-center outline-none"
        style={{ left: `${position}%` }}
      >
        <div className="absolute inset-y-0 left-1/2 w-0.5 -translate-x-1/2 bg-background/90" />
        <div className="relative flex size-9 items-center justify-center rounded-full bg-background text-foreground shadow-md ring-2 ring-background/50 focus-visible:ring-primary sm:size-11">
          <MoveHorizontal className="size-4 sm:size-5" />
        </div>
      </div>
    </div>
  );
}
