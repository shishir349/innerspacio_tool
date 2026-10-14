// Client-safe number formatting. Kept apart from estimate.ts so client components
// don't pull the whole rate card into their bundle.

export function formatLakh(n: number): string {
  return `₹${Number.isInteger(n) ? n : n.toFixed(1)}L`;
}

export function formatRange(e: { lowLakh: number; highLakh: number }): string {
  return `${formatLakh(e.lowLakh)} – ${formatLakh(e.highLakh)}`;
}
