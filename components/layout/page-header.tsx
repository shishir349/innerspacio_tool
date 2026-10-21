import { DrawLine } from "@/components/motion/draw-line";
import { SplitHeading } from "@/components/motion/split-heading";

/**
 * The one page header of the studio: the title rises out of a mask, a dimension line draws underneath.
 * `meta` is a quiet breadcrumb above the title (a path, never a kicker label), `actions` sit on the right.
 */
export function PageHeader({
  title,
  description,
  meta,
  actions,
  large = false,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  meta?: React.ReactNode;
  actions?: React.ReactNode;
  large?: boolean;
}) {
  return (
    <header>
      <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-5">
        <div className="min-w-0">
          {meta && <p className="mb-3 text-[0.9rem] text-ink-soft">{meta}</p>}
          <SplitHeading as="h1" scroll={false} className={`display ${large ? "display-lg" : "display-md"} text-foreground`}>
            {title}
          </SplitHeading>
          {description && <div className="mt-4 max-w-2xl text-[0.95rem] text-muted-foreground">{description}</div>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-3">{actions}</div>}
      </div>
      <DrawLine className="mt-6" />
    </header>
  );
}
