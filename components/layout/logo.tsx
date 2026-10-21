const HEIGHT = { sm: "h-9", md: "h-11", lg: "h-16" } as const;

/** The logo as a paintable mask: size it with width/height classes, colour it with a bg-* class. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <span
      role="img"
      aria-label="InnerSpacio"
      className={`block aspect-[890/260] ${className ?? ""}`}
      style={{
        WebkitMaskImage: "url(/logo.webp)",
        maskImage: "url(/logo.webp)",
        WebkitMaskSize: "contain",
        maskSize: "contain",
        WebkitMaskRepeat: "no-repeat",
        maskRepeat: "no-repeat",
        WebkitMaskPosition: "left center",
        maskPosition: "left center",
      }}
    />
  );
}

/**
 * The InnerSpacio logo (public/logo.webp, 890x260) painted through a mask, so it takes the palette:
 * royal blue on cream, cream on the navy stage. `studio` adds the quiet "Studio" tag for the signed-in tool.
 */
export function Logo({
  className,
  studio = true,
  size = "md",
}: {
  className?: string;
  studio?: boolean;
  size?: keyof typeof HEIGHT;
  /** Kept for call-site compatibility: the mask is a CSS background, so there is nothing to preload. */
  priority?: boolean;
}) {
  return (
    <span className={`inline-flex items-center gap-3 ${className ?? ""}`}>
      <LogoMark className={`${HEIGHT[size]} bg-royal dark:bg-cream`} />
      {studio && (
        <span className="label-caps hidden border-l border-border pl-3 text-ink-soft sm:inline">
          Studio
        </span>
      )}
    </span>
  );
}
