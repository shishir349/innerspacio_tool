export function Logo({ className }: { className?: string }) {
  return (
    <div className={className}>
      <div className="editorial-heading text-xl italic tracking-tight text-foreground">
        InnerSpacio
      </div>
      <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
        AI Studio
      </div>
    </div>
  );
}
