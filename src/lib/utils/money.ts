/** Money helpers. All amounts are integer-ish pence. */

export function formatPence(pence: number, opts: { approx?: boolean } = {}): string {
  if (!Number.isFinite(pence)) return "–";
  const p = Math.round(pence);
  const s = p < 100 ? `${p}p` : `£${(p / 100).toFixed(2)}`;
  return opts.approx ? `~${s}` : s;
}

export function formatRange(low: number, high: number): string {
  if (Math.round(low) === Math.round(high)) return formatPence(low);
  return `${formatPence(low)}–${formatPence(high)}`;
}

/** Parses "£3.50", "3.5", "350p" → pence. Returns null if invalid. */
export function parsePounds(input: string): number | null {
  const s = input.trim().replace(/,/g, "");
  if (!s) return null;
  const pence = s.match(/^(\d+)\s*p$/i);
  if (pence) return Number(pence[1]);
  const m = s.replace(/^£/, "").match(/^\d+(\.\d{1,2})?$/);
  if (!m) return null;
  return Math.round(Number(s.replace(/^£/, "")) * 100);
}
