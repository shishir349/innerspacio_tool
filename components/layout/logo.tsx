/** InnerSpacio wordmark: wide-tracked condensed caps under the roof line, as on innerspacio.com. */
export function Logo({
  className,
  studio = true,
  size = "md",
}: {
  className?: string;
  /** Show the "AI Studio" suffix (the signed-in tool). Client-facing pages omit it. */
  studio?: boolean;
  size?: "sm" | "md" | "lg";
}) {
  const text = size === "lg" ? "text-[1.6rem]" : size === "sm" ? "text-[0.9rem]" : "text-[1.1rem]";
  return (
    <span className={`inline-flex flex-col leading-none ${className ?? ""}`} aria-label="InnerSpacio">
      <svg viewBox="0 0 160 26" className="-mb-0.5 h-[0.95em] w-full text-current" style={{ fontSize: "1.4rem" }} aria-hidden>
        <path d="M10 25 L82 3 L154 25" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M118 20 v-6 h7 v6 M118 17 h7" fill="none" stroke="currentColor" strokeWidth="1" />
      </svg>
      <span className={`font-wordmark ${text} font-medium uppercase tracking-[0.34em] whitespace-nowrap`}>
        Innerspacio{studio && <span className="ml-3 tracking-[0.1em] text-muted-foreground">Studio</span>}
      </span>
    </span>
  );
}
