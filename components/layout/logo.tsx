import Image from "next/image";

const HEIGHT = { sm: "h-9", md: "h-11", lg: "h-16" } as const;

/** The InnerSpacio logo (public/logo.webp, 890x260). `studio` adds the quiet "Studio" tag for the signed-in tool. */
export function Logo({
  className,
  studio = true,
  size = "md",
  priority = false,
}: {
  className?: string;
  studio?: boolean;
  size?: keyof typeof HEIGHT;
  priority?: boolean;
}) {
  return (
    <span className={`inline-flex items-center gap-3 ${className ?? ""}`}>
      <Image
        src="/logo.webp"
        alt="InnerSpacio"
        width={890}
        height={260}
        priority={priority}
        className={`${HEIGHT[size]} w-auto`}
      />
      {studio && (
        <span className="font-caps hidden border-l border-border pl-3 text-[0.82rem] tracking-[0.12em] text-muted-foreground uppercase sm:inline">
          Studio
        </span>
      )}
    </span>
  );
}
