import { LogoMark } from "@/components/layout/logo";

export function LinkUnavailable({ reason }: { reason: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6">
      <div className="max-w-sm text-center">
        <LogoMark className="mx-auto h-14 bg-royal" />
        <p className="label-caps mt-3 text-muted-foreground">
          Your space, your story
        </p>
        <div className="mt-8 h-px w-16 bg-border mx-auto" />
        <p className="mt-8 text-base text-foreground">This link isn&apos;t available</p>
        <p className="mt-2 text-[0.95rem] leading-relaxed text-muted-foreground">{reason}</p>
      </div>
    </div>
  );
}
