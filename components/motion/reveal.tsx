/**
 * Staggered entrance for the direct children of a list or grid. Pure CSS (see `.reveal` in globals.css):
 * no JavaScript, so server-rendered content never flashes hidden-then-visible while the page hydrates.
 */
export function Reveal({ children, className }: { children: React.ReactNode; className?: string; [k: string]: unknown }) {
  return <div className={`reveal ${className ?? ""}`}>{children}</div>;
}
