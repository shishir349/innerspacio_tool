export function LinkUnavailable({ reason }: { reason: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6">
      <div className="max-w-sm text-center">
        <p className="display text-[2rem] italic text-foreground">InnerSpacio</p>
        <p className="mt-1 text-[0.85rem] uppercase tracking-[0.1em] text-muted-foreground">
          Your space, your story
        </p>
        <div className="mt-8 h-px w-16 bg-border mx-auto" />
        <p className="mt-8 text-base text-foreground">This link isn&apos;t available</p>
        <p className="mt-2 text-[0.95rem] leading-relaxed text-muted-foreground">{reason}</p>
      </div>
    </div>
  );
}
