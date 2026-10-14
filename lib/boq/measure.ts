/** Billing quantity from measurements, as the reference sheet's L/B/H columns intend. */
export function autoQty(uom: string, l: number | null, b: number | null, h: number | null): number | null {
  const r = (n: number) => Math.round(n * 100) / 100;
  if (uom === "Sq.Ft.") {
    if (l && b) return r(l * b);
    if (l && h) return r(l * h);
    return null;
  }
  if (uom === "Rft" || uom === "Rmt") return l ? r(l) : null;
  if (uom === "Cu.Ft.") return l && b && h ? r(l * b * h) : null;
  return null;
}
